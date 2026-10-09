import {
  type ProjectItem,
  type ProjectMeta,
  type ProjectSessionState,
  type ProjectSettings,
  type ProjectGroupSettings,
  type ProjectTrackSettings,
} from '@core/types/project';
import ContactSupportOutlinedIcon from '@mui/icons-material/ContactSupportOutlined';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import SettingsIcon from '@mui/icons-material/Settings';
import { getWebBaseUrl } from '@shared/config';
import { loadDemoProjectSafe } from '@shared/demo/loadDemoProject';
import {
  getPlatform,
  getPlatformUnavailableMessage,
  usePlatformCapabilities,
} from '@shared/platform';
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
import { streamingOrchestrator } from '@shared/streaming/streamingOrchestrator';
import {
  runNewProjectWithSessionGuard,
  stopLocalPlayerSession,
} from '@shared/utils/newProjectSessionGuard';
import { isProjectBindingCurrent } from '@shared/utils/projectBinding';
import { canDiscardUnsavedProjectChanges } from '@shared/utils/projectNavigationGuard';
import { runProjectSaveTransaction } from '@shared/utils/projectSaveTransaction';
import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';

import { usePartyProgramEndedEffects } from '../../workspaces/party/usePartyProgramEndedEffects';

import { AccountPopover } from './AccountPopover';
import { DesktopUpdateNotice } from './DesktopUpdateNotice';
import { HeaderPartyStatus } from './HeaderPartyStatus';
import { HeaderPlaybackPill } from './HeaderPlaybackPill';
import { ProjectNameInput } from './ProjectNameInput';
import { SaveProjectAsModal } from './SaveProjectAsModal';
import { LAYOUT_EDIT_DISABLED_TITLE } from './workspaceLayoutEditOptions';
import { WorkspaceMenu } from './WorkspaceMenu';

const layoutEditControlTitle = (defaultTitle: string, isLayoutEditMode: boolean): string => {
  return isLayoutEditMode ? LAYOUT_EDIT_DISABLED_TITLE : defaultTitle;
};

const caughtErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Неизвестная ошибка';
};

const confirmDiscardUnsavedChanges = (): boolean => {
  return window.confirm('В проекте есть несохранённые изменения. Продолжить и отбросить их?');
};

const directoryOfProjectFile = (filePath: string): string => {
  const lastSep = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
  return lastSep >= 0 ? filePath.slice(0, lastSep) : '.';
};

const projectStateDataForSave = (params: {
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
}): ProjectStateData => {
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
};

export const AppHeader: React.FC = () => {
  usePartyProgramEndedEffects();

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
    const sessionActive = sessionState.mode === 'session';
    if (
      !sessionActive &&
      !canDiscardUnsavedProjectChanges(meta.isDirty, confirmDiscardUnsavedChanges)
    ) {
      return;
    }
    void runNewProjectWithSessionGuard({
      sessionActive,
      confirmSessionStop: () =>
        window.confirm(
          'Активная сессия будет остановлена: звук прекратится, а трансляция вечеринки завершится. Текущий проект и несохранённые изменения будут сброшены. Создать новый проект?',
        ),
      stopLocally: stopLocalPlayerSession,
      stopServerSession: () =>
        enableStreaming && meta.linkedParty
          ? streamingOrchestrator.endServerSession()
          : Promise.resolve(),
      resetProject: newProject,
      onServerStopFailure: (error) => {
        addNotification({
          type: 'error',
          message: 'Сессия остановлена локально, но сервер не подтвердил завершение трансляции',
          duration: 5000,
        });
        console.error('Failed to end server session before creating a new project', error);
      },
    });
  }, [
    meta.isDirty,
    meta.linkedParty,
    sessionState.mode,
    newProject,
    enableStreaming,
    addNotification,
  ]);

  const runWithSavingIndicator = useCallback(async (operation: () => Promise<void>) => {
    setIsSaving(true);
    try {
      await operation();
    } finally {
      setIsSaving(false);
    }
  }, []);

  const handleLoadDemoProject = useCallback(async () => {
    if (!canDiscardUnsavedProjectChanges(meta.isDirty, confirmDiscardUnsavedChanges)) {
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
        let cherryPath = '';
        await runProjectSaveTransaction(
          async () => {
            ({ cherryPath } = await projectService.savePortableAs(targetDirectory, projectFile, {
              notifyOnIpcError: false,
            }));
          },
          () => {
            setName(baseName);
            setFilePath(cherryPath);
            resetDirty();
            setLastOpenedPlaylist(cherryPath);
            setPortableMode(true);
            setSaveAsModalOpen(false);
          },
        );
        return;
      }
      const normalizedDir = targetDirectory.replace(/[\\/]+$/, '');
      const path = `${normalizedDir}\\${baseName}.cherry`;

      await runProjectSaveTransaction(
        () =>
          projectService.saveProject(path, projectFile, {
            portableMode: settings.portableMode,
            notifyOnIpcError: false,
          }),
        () => {
          setName(baseName);
          setFilePath(path);
          resetDirty();
          setLastOpenedPlaylist(path);
          setSaveAsModalOpen(false);
        },
      );
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
            name: useProjectStore.getState().name,
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

    if (!canDiscardUnsavedProjectChanges(meta.isDirty, confirmDiscardUnsavedChanges)) {
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
              const currentProject = useProjectStore.getState();
              if (!isProjectBindingCurrent(currentProject.meta, path, linkedPartyFromFile.id)) {
                return;
              }
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

  const handleFeedback = async () => {
    try {
      const webBaseUrl = await getWebBaseUrl();
      const result = await getPlatform().invoke('system:openExternal', {
        url: `${webBaseUrl.replace(/\/+$/, '')}/feedback`,
      });
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to open feedback page');
      }
    } catch {
      addNotification({
        type: 'error',
        message: 'Не удалось открыть страницу обратной связи',
      });
    }
  };

  return (
    <div className="app-header">
      <DesktopUpdateNotice>
        {({ releaseNotice, compatibilityNotice }) => (
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
                  <button
                    type="button"
                    className="header-button"
                    onClick={() => void handleFeedback()}
                    aria-label="Обратная связь"
                    title="Обратная связь"
                  >
                    <ContactSupportOutlinedIcon className="header-button__icon" aria-hidden />
                  </button>
                </div>

                <div className="app-header-account-cluster">
                  {releaseNotice}
                  {enableStreaming ? (
                    <AccountPopover
                      isAuthenticated={isAuthenticated}
                      organizerName={organizer?.name}
                      disabled={isLayoutEditMode}
                    />
                  ) : null}
                </div>
              </div>

              <div className="app-header-project-row">
                <div className="app-header-project-main">
                  <div className="app-header-project-name">
                    <span className="app-header-project-name__eyebrow">Проект</span>
                    <div className="app-header-project-name__row">
                      <ProjectNameInput
                        disabled={isLayoutEditMode}
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
                      {showHeaderPartyStatus ? (
                        <HeaderPartyStatus disabled={isLayoutEditMode} />
                      ) : null}
                      {showHeaderPlaybackPill ? (
                        <HeaderPlaybackPill disabled={isLayoutEditMode} />
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <WorkspaceMenu />
              </div>
              {compatibilityNotice}
            </div>
          </div>
        )}
      </DesktopUpdateNotice>

      <SaveProjectAsModal
        key={saveAsModalKey}
        open={saveAsModalOpen}
        isSaving={isSaving}
        initialProjectName={useProjectStore.getState().name}
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
