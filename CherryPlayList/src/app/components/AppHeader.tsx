import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import AddIcon from '@mui/icons-material/Add';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import SaveIcon from '@mui/icons-material/Save';
import SaveAsIcon from '@mui/icons-material/SaveAs';
import SettingsIcon from '@mui/icons-material/Settings';
import React, { useCallback, useEffect, useState } from 'react';

import { DemoPlayer } from '@shared/components';
import { ipcService, projectService } from '@shared/services';
import { partyService } from '@shared/services/partyService';
import { useGlobalShortcuts } from '@shared/shortcuts';
import {
  LayoutPreset,
  useAuthStore,
  useLayoutStore,
  useProjectStore,
  useSettingsStore,
  useUIStore,
} from '@shared/stores';

export const AppHeader: React.FC = () => {
  const [isSaving, setIsSaving] = useState(false);

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
    resetDirty,
    getAllTracksInOrder,
  } = useProjectStore();

  const { openModal, addNotification, focusFileInBrowser } = useUIStore();
  const { setLastOpenedPlaylist, enableStreaming } = useSettingsStore();
  const { setLayoutPreset } = useLayoutStore();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated());
  const organizer = useAuthStore((state) => state.organizer);
  const [selectedLayout, setSelectedLayout] = useState<LayoutPreset>('simple');

  // В production не позволяем использовать complex layout
  useEffect(() => {
    const isDev = import.meta.env.DEV;
    if (!isDev && selectedLayout === 'complex') {
      const timeoutId = setTimeout(() => {
        setSelectedLayout('simple');
        setLayoutPreset('simple');
      }, 0);
      return () => clearTimeout(timeoutId);
    }
  }, [selectedLayout, setLayoutPreset]);

  const handleNew = useCallback(() => {
    newProject();
    addNotification({ type: 'info', message: 'Создан новый проект' });
  }, [newProject, addNotification]);

  const handleSaveAs = useCallback(async () => {
    try {
      setIsSaving(true);
      const path = await ipcService.showSaveDialog({
        title: 'Сохранить проект',
        defaultPath: name || 'project',
        filters: [{ name: 'Cherry Project', extensions: ['cherry'] }],
      });

      if (path) {
        const linkedPartyForFile = meta.linkedParty
          ? { id: meta.linkedParty.id, shortCode: meta.linkedParty.shortCode }
          : undefined;
        const projectFile = projectService.serializeProject({
          name,
          items,
          settings,
          trackSettings,
          groupSettings,
          sessionState,
          linkedParty: linkedPartyForFile,
        });
        await projectService.saveProject(path, projectFile, {
          portableMode: settings.portableMode,
        });
        setFilePath(path);
        resetDirty();
        setLastOpenedPlaylist(path);
        addNotification({ type: 'success', message: 'Проект сохранён' });
      }
    } catch (error) {
      addNotification({ type: 'error', message: `Ошибка сохранения: ${(error as Error).message}` });
    } finally {
      setIsSaving(false);
    }
  }, [
    name,
    items,
    settings,
    trackSettings,
    groupSettings,
    sessionState,
    meta.linkedParty,
    setFilePath,
    resetDirty,
    setLastOpenedPlaylist,
    addNotification,
  ]);

  const handleSave = useCallback(async () => {
    try {
      setIsSaving(true);
      // Если есть сохранённый путь - быстрое сохранение
      if (meta.filePath) {
        const linkedPartyForFile = meta.linkedParty
          ? { id: meta.linkedParty.id, shortCode: meta.linkedParty.shortCode }
          : undefined;
        const projectFile = projectService.serializeProject({
          name,
          items,
          settings,
          trackSettings,
          groupSettings,
          sessionState,
          linkedParty: linkedPartyForFile,
        });
        await projectService.saveProject(meta.filePath, projectFile, {
          portableMode: settings.portableMode,
        });
        resetDirty();
        addNotification({ type: 'success', message: 'Проект сохранён' });
      } else {
        // Иначе - Save As
        await handleSaveAs();
      }
    } catch (error) {
      addNotification({ type: 'error', message: `Ошибка сохранения: ${(error as Error).message}` });
    } finally {
      setIsSaving(false);
    }
  }, [
    meta.filePath,
    meta.linkedParty,
    name,
    items,
    settings,
    trackSettings,
    groupSettings,
    sessionState,
    resetDirty,
    addNotification,
    handleSaveAs,
  ]);

  const handleLoad = useCallback(async () => {
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
        addNotification({ type: 'success', message: 'Проект загружен' });

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
            .catch(() => {
              // Server unreachable — keep linkedParty without url
            });
        }
      }
    } catch (error) {
      addNotification({ type: 'error', message: `Ошибка загрузки: ${(error as Error).message}` });
    }
  }, [loadProject, setLastOpenedPlaylist, addNotification]);

  // Register global keyboard shortcuts
  useGlobalShortcuts({
    'global.save': handleSave,
    'global.saveAs': handleSaveAs,
    'global.open': handleLoad,
    'global.new': handleNew,
  });

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

  const handleLayoutChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const preset = e.target.value as LayoutPreset;
    const isDev = import.meta.env.DEV;

    // В production не позволяем выбирать complex
    if (preset === 'complex' && !isDev) {
      return;
    }

    if (
      preset === 'simple' ||
      preset === 'complex' ||
      preset === 'collections' ||
      preset === 'collections-vertical' ||
      preset === 'player' ||
      (preset === 'party' && enableStreaming)
    ) {
      setSelectedLayout(preset);
      setLayoutPreset(preset);
      const presetNames: Record<LayoutPreset, string> = {
        simple: 'Простой',
        complex: 'Сложный',
        collections: 'С коллекциями',
        'collections-vertical': 'Коллекции вертикально',
        player: 'Плеер',
        party: 'Вечеринка',
      };
      addNotification({
        type: 'info',
        message: `Layout изменён: ${presetNames[preset]}`,
      });
    }
  };

  return (
    <div className="app-header">
      <div className="app-header-toolbar">
        <div className="app-header-left">
          <div className="app-header-actions">
            <div className="action-group">
              <button className="header-button" onClick={handleNew} title="Новый проект (Ctrl+N)">
                <AddIcon style={{ fontSize: '32px' }} />
              </button>
              <button
                className="header-button"
                onClick={handleSave}
                title={meta.filePath ? 'Сохранить (Ctrl+S)' : 'Сохранить как... (Ctrl+S)'}
                disabled={isSaving}
              >
                {isSaving ? (
                  <span
                    className="header-button-loader"
                    aria-label="Сохранение..."
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      border: '3px solid rgba(255,255,255,0.2)',
                      borderTopColor: '#fff',
                      boxSizing: 'border-box',
                      animation: 'spin 0.8s linear infinite',
                    }}
                  />
                ) : (
                  <SaveIcon style={{ fontSize: '32px' }} />
                )}
              </button>
              <button
                className="header-button"
                onClick={handleSaveAs}
                title="Сохранить как... (Ctrl+Shift+S)"
              >
                <SaveAsIcon style={{ fontSize: '32px' }} />
              </button>
              <button
                className="header-button"
                onClick={handleLoad}
                title="Открыть проект (Ctrl+O)"
              >
                <FolderOpenIcon style={{ fontSize: '32px' }} />
              </button>
            </div>

            <div className="action-group">
              <button className="header-button" onClick={handleExport} title="Экспортировать">
                <FileDownloadIcon style={{ fontSize: '32px' }} />
              </button>
            </div>

            <div className="action-group">
              {enableStreaming && (
                <button
                  className="header-button"
                  onClick={handleAccount}
                  title={
                    isAuthenticated
                      ? `Аккаунт: ${organizer?.name || 'Организатор'}`
                      : 'Войти в аккаунт'
                  }
                  style={{
                    position: 'relative',
                    color: isAuthenticated ? '#9e9e9e' : undefined,
                  }}
                >
                  <AccountCircleIcon style={{ fontSize: '32px' }} />
                  {isAuthenticated && (
                    <span
                      style={{
                        position: 'absolute',
                        top: '2px',
                        right: '2px',
                        width: '8px',
                        height: '8px',
                        backgroundColor: '#4caf50',
                        borderRadius: '50%',
                        border: '1px solid white',
                      }}
                      title="Авторизован"
                    />
                  )}
                </button>
              )}
              <button className="header-button" onClick={handleSettings} title="Настройки">
                <SettingsIcon style={{ fontSize: '32px' }} />
              </button>
            </div>
          </div>

          <div className="app-header-project-name">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="project-name-input"
              placeholder="Название проекта"
            />
            {meta.isDirty && (
              <span className="dirty-indicator" title="Есть несохранённые изменения">
                *
              </span>
            )}
          </div>

          <div className="app-header-layout">
            <label htmlFor="layout-select" className="app-header-layout__label">
              Layout:
            </label>
            <select
              id="layout-select"
              value={selectedLayout}
              onChange={handleLayoutChange}
              className="layout-select"
            >
              <option value="simple">Простой (Playlist + Browser)</option>
              {import.meta.env.DEV && <option value="complex">Сложный (с тестовыми зонами)</option>}
              <option value="collections">С коллекциями (Playlist + Collections + Browser)</option>
              <option value="collections-vertical">
                Коллекции вертикально (Playlist + Collections + Browser)
              </option>
              <option value="player">Плеер (Player + Browser)</option>
              {enableStreaming && <option value="party">Вечеринка (Player + Party)</option>}
            </select>
          </div>
        </div>

        <DemoPlayer className="app-header-demo-player" onShowInBrowser={focusFileInBrowser} />
      </div>
    </div>
  );
};
