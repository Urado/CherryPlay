import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import SettingsIcon from '@mui/icons-material/Settings';
import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';

import {
  type ProjectItem,
  type ProjectMeta,
  type ProjectSessionState,
  type ProjectSettings,
  type ProjectGroupSettings,
  type ProjectTrackSettings,
} from '@core/types/project';
import { loadDemoProjectSafe } from '@shared/demo/loadDemoProject';
import { getPlatformUnavailableMessage, usePlatformCapabilities } from '@shared/platform';
import { ipcService, projectService } from '@shared/services';
import type { ProjectStateData } from '@shared/services';
import { partyService } from '@shared/services/partyService';
import { useGlobalShortcuts, usePlayerShortcuts } from '@shared/shortcuts';
import {
  useAuthStore,
  useLayoutStore,
  useProjectStore,
  useSettingsStore,
  useUIStore,
} from '@shared/stores';

import { HeaderPartyStatus } from './HeaderPartyStatus';
import { HeaderPlaybackPill } from './HeaderPlaybackPill';
import { SaveProjectAsModal } from './SaveProjectAsModal';
import { LAYOUT_EDIT_DISABLED_TITLE } from './workspaceLayoutEditOptions';
import { WorkspaceMenu } from './WorkspaceMenu';

function layoutEditControlTitle(defaultTitle: string, isLayoutEditMode: boolean): string {
  return isLayoutEditMode ? LAYOUT_EDIT_DISABLED_TITLE : defaultTitle;
}

function caughtErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Неизвестная ошибка';
}

function confirmDiscardUnsavedChanges(): boolean {
  return window.confirm('В проекте есть несохранённые изменения. Продолжить и отбросить их?');
}

function directoryOfProjectFile(filePath: string): string {
  const lastSep = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
  return lastSep >= 0 ? filePath.slice(0, lastSep) : '.';
}

function projectStateDataForSave(params: {
  name: string;
  items: ProjectItem[];
  settings: ProjectSettings;
  trackSettings: Map<string, ProjectTrackSettings>;
  groupSettings: Map<string, ProjectGroupSettings>;
  sessionState: ProjectSessionState;
  meta: Pick<
    ProjectMeta,
    'linkedParty' | 'partyTrackDisplay' | 'partyThemeId' | 'partyCustomizationSettings'
  >;
}): ProjectStateData {
  const { name, items, settings, trackSettings, groupSettings, sessionState, meta } = params;
  const linkedParty = meta.linkedParty
    ? { id: meta.linkedParty.id, shortCode: meta.linkedParty.shortCode }
    : undefined;
  return {
    name,
    items,
    settings,
    trackSettings,
    groupSettings,
    sessionState,
    linkedParty,
    partyTrackDisplay: meta.partyTrackDisplay,
    partyThemeId: meta.partyThemeId,
    partyCustomizationSettings: meta.partyCustomizationSettings,
  };
}

export const AppHeader: React.FC = () => {
  const [isSaving, setIsSaving] = useState(false);
  const [saveAsModalOpen, setSaveAsModalOpen] = useState(false);
  const [saveAsModalKey, setSaveAsModalKey] = useState(0);
  const [saveAsInitialDirectory, setSaveAsInitialDirectory] = useState('');
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const projectMenuRef = useRef<HTMLDivElement>(null);
  const projectMenuPanelRef = useRef<HTMLDivElement>(null);
  const projectMenuTriggerRef = useRef<HTMLButtonElement>(null);
  const projectMenuTriggerId = useId();
  const projectMenuPanelId = useId();

  const {
    name,
    items,
    settings,
    trackSettings,
    groupSettings,
    sessionState,
    meta,
    setName,
    newProject,
    loadProject,
    setFilePath,
    setPortableMode,
    resetDirty,
    getAllTracksInOrder,
  } = useProjectStore();

  const { openModal, addNotification } = useUIStore();
  const { setLastOpenedPlaylist, enableStreaming, streamingSource } = useSettingsStore();
  const isLayoutEditMode = useLayoutStore((state) => state.isLayoutEditMode);
  const showHeaderPartyStatus = enableStreaming;
  const showHeaderPlaybackPill =
    sessionState.mode === 'session' && streamingSource === 'cherryPlayPlayer';
  const showHeaderPlaybackPillRow = showHeaderPartyStatus || showHeaderPlaybackPill;
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated());
  const organizer = useAuthStore((state) => state.organizer);
  const { supportsProjectPersistence, usesFixtureFileBrowser } = usePlatformCapabilities();

  const notifyDemoBlocked = useCallback(() => {
    addNotification({ type: 'warning', message: getPlatformUnavailableMessage() });
  }, [addNotification]);
  const closeProjectMenu = useCallback(() => setProjectMenuOpen(false), []);

  const openSaveAsModal = useCallback(() => {
    setSaveAsInitialDirectory(meta.filePath ? directoryOfProjectFile(meta.filePath) : '');
    setSaveAsModalKey((k) => k + 1);
    setSaveAsModalOpen(true);
  }, [meta.filePath]);

  const focusProjectMenuItemAt = useCallback((index: number) => {
    const panel = projectMenuPanelRef.current;
    if (!panel) return;
    const items = [...panel.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])')];
    if (items.length === 0) return;
    const i = ((index % items.length) + items.length) % items.length;
    items[i]?.focus();
  }, []);

  useEffect(() => {
    if (!projectMenuOpen) return;
    const onDocMouseDown = (e: MouseEvent) => {
      if (projectMenuRef.current && !projectMenuRef.current.contains(e.target as Node)) {
        setProjectMenuOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setProjectMenuOpen(false);
        queueMicrotask(() => projectMenuTriggerRef.current?.focus());
      }
    };
    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [projectMenuOpen]);

  useEffect(() => {
    if (!projectMenuOpen) return;
    const id = window.requestAnimationFrame(() => {
      focusProjectMenuItemAt(0);
    });
    return () => window.cancelAnimationFrame(id);
  }, [projectMenuOpen, focusProjectMenuItemAt]);

  const onProjectMenuKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const panel = projectMenuPanelRef.current;
      if (!panel) return;
      const items = [...panel.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])')];
      if (items.length === 0) return;
      const current = items.indexOf(document.activeElement as HTMLElement);

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          focusProjectMenuItemAt(current < 0 ? 0 : current + 1);
          break;
        case 'ArrowUp':
          e.preventDefault();
          focusProjectMenuItemAt(current < 0 ? items.length - 1 : current - 1);
          break;
        case 'Home':
          e.preventDefault();
          focusProjectMenuItemAt(0);
          break;
        case 'End':
          e.preventDefault();
          focusProjectMenuItemAt(items.length - 1);
          break;
        default:
          break;
      }
    },
    [focusProjectMenuItemAt],
  );

  const onProjectMenuTriggerKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (projectMenuOpen) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        setProjectMenuOpen(true);
      }
    },
    [projectMenuOpen],
  );

  const handleNew = useCallback(() => {
    if (meta.isDirty && !confirmDiscardUnsavedChanges()) {
      return;
    }
    newProject();
  }, [meta.isDirty, newProject]);

  const runWithSavingIndicator = useCallback(async (operation: () => Promise<void>) => {
    setIsSaving(true);
    try {
      await operation();
    } finally {
      setIsSaving(false);
    }
  }, []);

  const handleLoadDemoProject = useCallback(async () => {
    if (meta.isDirty && !confirmDiscardUnsavedChanges()) {
      return;
    }
    await loadDemoProjectSafe();
  }, [meta.isDirty]);

  const runSaveAsFromModal = useCallback(
    async (payload: { portable: boolean; projectName: string; targetDirectory: string }) => {
      if (!supportsProjectPersistence) {
        notifyDemoBlocked();
        return;
      }

      const projectName = payload.projectName.trim();
      const targetDirectory = payload.targetDirectory.trim();
      const portablePackage = payload.portable;
      const baseName = projectName.toLowerCase().endsWith('.cherry')
        ? projectName.slice(0, -7).trim()
        : projectName;

      if (!baseName) {
        addNotification({ type: 'error', message: 'Укажите название проекта' });
        return;
      }
      if (!targetDirectory) {
        addNotification({ type: 'error', message: 'Укажите папку назначения' });
        return;
      }

      const stateData = projectStateDataForSave({
        name: baseName,
        items,
        settings,
        trackSettings,
        groupSettings,
        sessionState,
        meta,
      });
      const projectFile = projectService.serializeProject(stateData);

      if (portablePackage) {
        const { cherryPath } = await projectService.savePortableAs(targetDirectory, projectFile, {
          notifyOnIpcError: false,
        });
        setName(baseName);
        setFilePath(cherryPath);
        resetDirty();
        setLastOpenedPlaylist(cherryPath);
        setPortableMode(true);
        setSaveAsModalOpen(false);
        return;
      }
      const normalizedDir = targetDirectory.replace(/[\\/]+$/, '');
      const path = `${normalizedDir}\\${baseName}.cherry`;

      await projectService.saveProject(path, projectFile, {
        portableMode: settings.portableMode,
        notifyOnIpcError: false,
      });
      setName(baseName);
      setFilePath(path);
      resetDirty();
      setLastOpenedPlaylist(path);
      setSaveAsModalOpen(false);
    },
    [
      items,
      settings,
      trackSettings,
      groupSettings,
      sessionState,
      meta,
      addNotification,
      setFilePath,
      setName,
      setPortableMode,
      resetDirty,
      setLastOpenedPlaylist,
      supportsProjectPersistence,
      notifyDemoBlocked,
    ],
  );

  const handleSaveAsModalConfirm = useCallback(
    async (payload: { portable: boolean; projectName: string; targetDirectory: string }) => {
      try {
        await runWithSavingIndicator(() => runSaveAsFromModal(payload));
      } catch (error) {
        addNotification({
          type: 'error',
          message: `Ошибка сохранения: ${caughtErrorMessage(error)}`,
        });
      }
    },
    [runWithSavingIndicator, runSaveAsFromModal, addNotification],
  );

  const handleSave = useCallback(async () => {
    if (!supportsProjectPersistence) {
      notifyDemoBlocked();
      return;
    }

    const quickSavePath = meta.filePath;
    if (!quickSavePath) {
      openSaveAsModal();
      return;
    }
    try {
      await runWithSavingIndicator(async () => {
        const projectFile = projectService.serializeProject(
          projectStateDataForSave({
            name,
            items,
            settings,
            trackSettings,
            groupSettings,
            sessionState,
            meta,
          }),
        );
        await projectService.saveProject(quickSavePath, projectFile, {
          portableMode: settings.portableMode,
        });
        resetDirty();
      });
    } catch (error) {
      addNotification({
        type: 'error',
        message: `Ошибка сохранения: ${caughtErrorMessage(error)}`,
      });
    }
  }, [
    runWithSavingIndicator,
    meta,
    name,
    items,
    settings,
    trackSettings,
    groupSettings,
    sessionState,
    resetDirty,
    addNotification,
    openSaveAsModal,
    supportsProjectPersistence,
    notifyDemoBlocked,
  ]);

  const handleLoad = useCallback(async () => {
    if (!supportsProjectPersistence) {
      notifyDemoBlocked();
      return;
    }

    if (meta.isDirty && !confirmDiscardUnsavedChanges()) {
      return;
    }

    try {
      const path = await ipcService.showOpenFileDialog({
        title: 'Открыть проект',
        filters: [{ name: 'Cherry Project', extensions: ['cherry'] }],
      });

      if (path) {
        const projectData = await projectService.loadProject(path);
        const linkedPartyFromFile = projectData.linkedParty
          ? { id: projectData.linkedParty.id, shortCode: projectData.linkedParty.shortCode }
          : null;
        loadProject({
          ...projectData,
          filePath: path,
          linkedParty: linkedPartyFromFile,
        });
        setLastOpenedPlaylist(path);

        if (linkedPartyFromFile?.shortCode) {
          partyService
            .getPartyUrl(linkedPartyFromFile.shortCode)
            .then((url) => {
              useProjectStore.getState().setLinkedParty({
                id: linkedPartyFromFile.id,
                shortCode: linkedPartyFromFile.shortCode,
                url,
              });
            })
            .catch(() => {});
        }
      }
    } catch (error) {
      addNotification({ type: 'error', message: `Ошибка загрузки: ${caughtErrorMessage(error)}` });
    }
  }, [
    loadProject,
    setLastOpenedPlaylist,
    addNotification,
    supportsProjectPersistence,
    notifyDemoBlocked,
    meta.isDirty,
  ]);

  const globalShortcutHandlers = useMemo(
    () => ({
      'global.save': () => {
        closeProjectMenu();
        if (!supportsProjectPersistence) {
          notifyDemoBlocked();
          return;
        }
        void handleSave();
      },
      'global.saveAs': () => {
        closeProjectMenu();
        if (!supportsProjectPersistence) {
          notifyDemoBlocked();
          return;
        }
        if (!meta.filePath) {
          void handleSave();
        } else {
          openSaveAsModal();
        }
      },
      'global.open': () => {
        closeProjectMenu();
        void handleLoad();
      },
      'global.new': () => {
        closeProjectMenu();
        handleNew();
      },
    }),
    [
      closeProjectMenu,
      handleSave,
      handleLoad,
      handleNew,
      openSaveAsModal,
      meta.filePath,
      supportsProjectPersistence,
      notifyDemoBlocked,
    ],
  );

  useEffect(() => {
    if (isLayoutEditMode) {
      setProjectMenuOpen(false);
    }
  }, [isLayoutEditMode]);

  useGlobalShortcuts(globalShortcutHandlers, { enabled: !isLayoutEditMode });
  usePlayerShortcuts({ enabled: !isLayoutEditMode });

  const handleExport = () => {
    const allTracks = getAllTracksInOrder();
    if (allTracks.length === 0) {
      addNotification({ type: 'warning', message: 'Проект пуст' });
      return;
    }

    openModal('export');
  };

  const handleSettings = () => {
    openModal('settings');
  };

  const handleAccount = () => {
    openModal('account');
  };

  return (
    <div className="app-header">
      <div className="app-header-toolbar">
        <div className="app-header-left">
          <div className="app-header-top-row">
            <div className="app-header-file-cluster">
              <div className="project-menu" ref={projectMenuRef}>
                <button
                  ref={projectMenuTriggerRef}
                  type="button"
                  id={projectMenuTriggerId}
                  className="project-menu__trigger header-button"
                  onClick={() => setProjectMenuOpen((o) => !o)}
                  onKeyDown={onProjectMenuTriggerKeyDown}
                  aria-haspopup="menu"
                  aria-expanded={projectMenuOpen}
                  aria-controls={projectMenuPanelId}
                  aria-busy={isSaving}
                  aria-label="Файл"
                  disabled={isLayoutEditMode}
                  title={layoutEditControlTitle(
                    'Файл (Ctrl+N, Ctrl+O, Ctrl+S, Ctrl+Shift+S)',
                    isLayoutEditMode,
                  )}
                >
                  {isSaving && <span className="project-menu__trigger-spinner" aria-hidden />}
                  <InsertDriveFileOutlinedIcon
                    className="header-button__icon header-button__icon--compact"
                    aria-hidden
                  />
                </button>
                {projectMenuOpen && (
                  <div
                    ref={projectMenuPanelRef}
                    id={projectMenuPanelId}
                    className="project-menu__panel"
                    role="menu"
                    tabIndex={-1}
                    aria-labelledby={projectMenuTriggerId}
                    onKeyDown={onProjectMenuKeyDown}
                  >
                    <button
                      type="button"
                      className="project-menu__item"
                      role="menuitem"
                      disabled={isSaving}
                      onClick={() => {
                        closeProjectMenu();
                        handleNew();
                      }}
                    >
                      Новый проект
                    </button>
                    <button
                      type="button"
                      className="project-menu__item"
                      role="menuitem"
                      disabled={isSaving}
                      onClick={() => {
                        closeProjectMenu();
                        void handleLoad();
                      }}
                    >
                      Открыть проект…
                    </button>
                    {usesFixtureFileBrowser && (
                      <button
                        type="button"
                        className="project-menu__item"
                        role="menuitem"
                        disabled={isSaving}
                        title="Загружает учебный демо-проект, не настоящую вечеринку"
                        onClick={() => {
                          closeProjectMenu();
                          void handleLoadDemoProject();
                        }}
                      >
                        Учебный демо-проект…
                      </button>
                    )}
                    <button
                      type="button"
                      className="project-menu__item"
                      role="menuitem"
                      disabled={isSaving}
                      title="Экспортирует файлы плейлиста в выбранную папку"
                      onClick={() => {
                        closeProjectMenu();
                        handleExport();
                      }}
                    >
                      Экспорт
                    </button>
                    <button
                      type="button"
                      className="project-menu__item"
                      role="menuitem"
                      disabled={isSaving}
                      onClick={() => {
                        closeProjectMenu();
                        void handleSave();
                      }}
                    >
                      {isSaving ? (
                        <span className="project-menu__item-with-loader">
                          <span
                            className="project-menu__save-spinner"
                            aria-label="Сохранение…"
                            role="status"
                          />
                          Сохранить проект
                        </span>
                      ) : (
                        'Сохранить проект'
                      )}
                    </button>
                    {meta.filePath ? (
                      <button
                        type="button"
                        className="project-menu__item"
                        role="menuitem"
                        disabled={isSaving}
                        onClick={() => {
                          closeProjectMenu();
                          openSaveAsModal();
                        }}
                      >
                        Сохранить как…
                      </button>
                    ) : null}
                  </div>
                )}
              </div>
              <button
                className="header-button"
                onClick={handleSettings}
                disabled={isLayoutEditMode}
                aria-label="Настройки"
                title={layoutEditControlTitle('Настройки', isLayoutEditMode)}
              >
                <SettingsIcon className="header-button__icon" aria-hidden />
              </button>
            </div>

            {enableStreaming ? (
              <div className="app-header-account-cluster">
                <button
                  className={`header-button${isAuthenticated ? ' header-button--account-authenticated' : ''}`}
                  onClick={handleAccount}
                  disabled={isLayoutEditMode}
                  aria-label="Аккаунт"
                  title={layoutEditControlTitle(
                    isAuthenticated
                      ? `Аккаунт: ${organizer?.name || 'Организатор'}`
                      : 'Войти в аккаунт',
                    isLayoutEditMode,
                  )}
                >
                  <AccountCircleIcon className="header-button__icon" aria-hidden />
                  {isAuthenticated && <span className="header-auth-dot" title="Авторизован" />}
                </button>
              </div>
            ) : null}
          </div>

          <div className="app-header-project-row">
            <div className="app-header-project-main">
              <div className="app-header-project-name">
                <span className="app-header-project-name__eyebrow">Проект</span>
                <div className="app-header-project-name__row">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="project-name-input"
                    placeholder="Название проекта"
                    disabled={isLayoutEditMode}
                    aria-label="Название проекта"
                    title={layoutEditControlTitle('Название проекта', isLayoutEditMode)}
                  />
                  {meta.isDirty && (
                    <span className="dirty-indicator" title="Есть несохранённые изменения">
                      *
                    </span>
                  )}
                </div>
              </div>

              {showHeaderPlaybackPillRow ? (
                <div className="app-header-playback-pill-row">
                  {showHeaderPartyStatus ? <HeaderPartyStatus disabled={isLayoutEditMode} /> : null}
                  {showHeaderPlaybackPill ? (
                    <HeaderPlaybackPill disabled={isLayoutEditMode} />
                  ) : null}
                </div>
              ) : null}
            </div>

            <WorkspaceMenu />
          </div>
        </div>
      </div>

      <SaveProjectAsModal
        key={saveAsModalKey}
        open={saveAsModalOpen}
        isSaving={isSaving}
        initialProjectName={name}
        initialDirectory={saveAsInitialDirectory}
        onRequestDirectory={(currentDirectory) =>
          ipcService.showFolderDialog({
            title: 'Выберите папку для сохранения проекта',
            defaultPath: currentDirectory || undefined,
          })
        }
        onClose={() => {
          if (!isSaving) {
            setSaveAsModalOpen(false);
          }
        }}
        onConfirm={handleSaveAsModalConfirm}
      />
    </div>
  );
};
