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
import { useGlobalShortcuts } from '@shared/shortcuts';
import {
  LayoutPreset,
  useAuthStore,
  useLayoutStore,
  usePartyStore,
  useProjectStore,
  useSettingsStore,
  useUIStore,
} from '@shared/stores';

export const AppHeader: React.FC = () => {
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
      const path = await ipcService.showSaveDialog({
        title: 'Сохранить проект',
        defaultPath: name || 'project',
        filters: [{ name: 'Cherry Project', extensions: ['cherry'] }],
      });

      if (path) {
        const projectFile = projectService.serializeProject({
          name,
          items,
          settings,
          trackSettings,
          groupSettings,
          sessionState,
          linkedParty: meta.linkedParty ?? undefined,
        });
        await projectService.saveProject(path, projectFile);
        setFilePath(path);
        resetDirty();
        setLastOpenedPlaylist(path);
        addNotification({ type: 'success', message: 'Проект сохранён' });
      }
    } catch (error) {
      addNotification({ type: 'error', message: `Ошибка сохранения: ${(error as Error).message}` });
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
      // Если есть сохранённый путь - быстрое сохранение
      if (meta.filePath) {
        const projectFile = projectService.serializeProject({
          name,
          items,
          settings,
          trackSettings,
          groupSettings,
          sessionState,
          linkedParty: meta.linkedParty ?? undefined,
        });
        await projectService.saveProject(meta.filePath, projectFile);
        resetDirty();
        addNotification({ type: 'success', message: 'Проект сохранён' });
      } else {
        // Иначе - Save As
        await handleSaveAs();
      }
    } catch (error) {
      addNotification({ type: 'error', message: `Ошибка сохранения: ${(error as Error).message}` });
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
        const projectFile = await projectService.loadProject(path);
        const projectData = projectService.deserializeProject(projectFile);
        loadProject({
          ...projectData,
          filePath: path,
          linkedParty: projectFile.linkedParty ?? null,
        });
        if (projectFile.linkedParty) {
          usePartyStore.getState().setCreatedParty({
            id: projectFile.linkedParty.id,
            shortCode: projectFile.linkedParty.shortCode,
            url: projectFile.linkedParty.url,
          });
        } else {
          usePartyStore.getState().setCreatedParty(null);
        }
        setLastOpenedPlaylist(path);
        addNotification({ type: 'success', message: 'Проект загружен' });
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
              >
                <SaveIcon style={{ fontSize: '32px' }} />
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
