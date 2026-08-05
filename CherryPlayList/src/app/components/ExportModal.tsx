import { Button, IconButton } from '@cherryplay/components';
import CloseIcon from '@mui/icons-material/Close';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import React, { useState, useEffect, useRef, useCallback } from 'react';

import { useModalKeyboard } from '@shared/hooks';
import { exportService, ipcService } from '@shared/services';
import { useProjectStore, useSettingsStore, useUIStore } from '@shared/stores';

export const ExportModal: React.FC = () => {
  const { modal, closeModal, addNotification } = useUIStore();
  const { name, getAllTracksInOrder } = useProjectStore();
  const { exportPath, setExportPath, exportStrategy, setExportStrategy } = useSettingsStore();
  const [localExportPath, setLocalExportPath] = useState(exportPath);
  const [localExportStrategy, setLocalExportStrategy] = useState(exportStrategy);

  const prevModalRef = useRef<string | null>(null);

  useEffect(() => {
    const wasClosed = prevModalRef.current !== 'export';
    const isNowOpen = modal === 'export';

    if (isNowOpen && wasClosed) {
      const timeoutId = setTimeout(() => {
        setLocalExportPath(exportPath);
        setLocalExportStrategy(exportStrategy);
      }, 0);
      return () => clearTimeout(timeoutId);
    }

    prevModalRef.current = modal;
  }, [modal, exportPath, exportStrategy]);

  const handleBrowse = useCallback(async () => {
    try {
      const path = await ipcService.showFolderDialog({
        title: 'Выберите папку для экспорта',
        defaultPath: localExportPath,
      });

      if (path) {
        setLocalExportPath(path);
      }
    } catch (error) {
      addNotification({
        type: 'error',
        message: `Ошибка выбора папки: ${(error as Error).message}`,
      });
    }
  }, [addNotification, localExportPath]);

  const handleExport = useCallback(async () => {
    const tracksToExport = getAllTracksInOrder();
    if (tracksToExport.length === 0) {
      addNotification({ type: 'warning', message: 'Плейлист пуст' });
      return;
    }

    if (!localExportPath) {
      addNotification({ type: 'error', message: 'Выберите папку для экспорта' });
      return;
    }

    try {
      setExportPath(localExportPath);
      setExportStrategy(localExportStrategy);

      if (localExportStrategy === 'aimpPlaylist') {
        await exportService.exportAIMPPlaylist(tracksToExport, localExportPath, name);
      } else {
        await exportService.exportWithNumberPrefix(tracksToExport, localExportPath);
      }

      closeModal();
    } catch (error) {
      addNotification({ type: 'error', message: `Ошибка экспорта: ${(error as Error).message}` });
    }
  }, [
    addNotification,
    closeModal,
    getAllTracksInOrder,
    localExportPath,
    localExportStrategy,
    name,
    setExportPath,
    setExportStrategy,
  ]);

  const handleCancel = useCallback(() => {
    setLocalExportPath(exportPath);
    setLocalExportStrategy(exportStrategy);
    closeModal();
  }, [closeModal, exportPath, exportStrategy]);

  const { handleOverlayKeyDown } = useModalKeyboard({
    enabled: modal === 'export',
    onCancel: handleCancel,
    onPrimary: () => {
      void handleExport();
    },
  });

  if (modal !== 'export') {
    return null;
  }

  const handleOverlayClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      handleCancel();
    }
  };

  return (
    <div
      className="modal-overlay"
      onClick={handleOverlayClick}
      onKeyDown={handleOverlayKeyDown}
      role="button"
      tabIndex={0}
      aria-label="Close export modal"
    >
      <div className="modal-content">
        <div className="modal-header">
          <h2 className="modal-title">Экспорт плейлиста</h2>
          <IconButton
            className="modal-close"
            type="button"
            onClick={handleCancel}
            aria-label="Закрыть"
            icon={<CloseIcon />}
            variant="ghost"
            size="md"
          />
        </div>

        <div className="modal-body">
          <div className="settings-group">
            <label className="settings-label" htmlFor="export-path">
              Папка экспорта
            </label>
            <div className="settings-input-group">
              <input
                type="text"
                className="settings-input"
                value={localExportPath}
                onChange={(e) => setLocalExportPath(e.target.value)}
                placeholder="Выберите папку..."
                id="export-path"
              />
              <button className="settings-browse-button" onClick={() => void handleBrowse()}>
                <FolderOpenIcon />
              </button>
            </div>
          </div>

          <div className="settings-group">
            <label className="settings-label" htmlFor="export-strategy">
              Способ экспорта
            </label>
            <select
              className="settings-select"
              value={localExportStrategy}
              onChange={(e) =>
                setLocalExportStrategy(e.target.value as 'copyWithNumberPrefix' | 'aimpPlaylist')
              }
              id="export-strategy"
            >
              <option value="copyWithNumberPrefix">Копирование с нумерацией (01 - имя.mp3)</option>
              <option value="aimpPlaylist">AIMP плейлист (M3U8 с относительными путями)</option>
            </select>
          </div>
        </div>

        <div className="modal-footer">
          <Button
            className="modal-button"
            type="button"
            onClick={handleCancel}
            variant="secondary"
            size="sm"
          >
            Отмена
          </Button>
          <Button
            className="modal-button"
            type="button"
            onClick={() => void handleExport()}
            variant="primary"
            size="sm"
          >
            Экспортировать
          </Button>
        </div>
      </div>
    </div>
  );
};
