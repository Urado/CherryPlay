import CloseIcon from '@mui/icons-material/Close';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import React, { useState, useEffect, useRef } from 'react';

import { exportService, ipcService } from '@shared/services';
import { useProjectStore, useSettingsStore, useUIStore } from '@shared/stores';

export const ExportModal: React.FC = () => {
  const { modal, closeModal, addNotification } = useUIStore();
  const { name, getAllTracksInOrder } = useProjectStore();
  const tracks = getAllTracksInOrder();
  const { exportPath, setExportPath, exportStrategy, setExportStrategy } = useSettingsStore();
  const [localExportPath, setLocalExportPath] = useState(exportPath);
  const [localExportStrategy, setLocalExportStrategy] = useState(exportStrategy);

  // Синхронизируем локальные значения при открытии модального окна
  const prevModalRef = useRef<string | null>(null);

  useEffect(() => {
    const wasClosed = prevModalRef.current !== 'export';
    const isNowOpen = modal === 'export';

    if (isNowOpen && wasClosed) {
      // Модальное окно только что открылось - синхронизируем значения
      const timeoutId = setTimeout(() => {
        setLocalExportPath(exportPath);
        setLocalExportStrategy(exportStrategy);
      }, 0);
      return () => clearTimeout(timeoutId);
    }

    prevModalRef.current = modal;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modal]);

  if (modal !== 'export') {
    return null;
  }

  const handleBrowse = async () => {
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
  };

  const handleExport = async () => {
    if (tracks.length === 0) {
      addNotification({ type: 'warning', message: 'Плейлист пуст' });
      return;
    }

    if (!localExportPath) {
      addNotification({ type: 'error', message: 'Выберите папку для экспорта' });
      return;
    }

    try {
      // Сохраняем настройки
      setExportPath(localExportPath);
      setExportStrategy(localExportStrategy);

      // Выполняем экспорт
      if (localExportStrategy === 'aimpPlaylist') {
        await exportService.exportAIMPPlaylist(tracks, localExportPath, name);
      } else {
        await exportService.exportWithNumberPrefix(tracks, localExportPath);
      }

      addNotification({ type: 'success', message: 'Экспорт завершён' });
      closeModal();
    } catch (error) {
      addNotification({ type: 'error', message: `Ошибка экспорта: ${(error as Error).message}` });
    }
  };

  const handleCancel = () => {
    setLocalExportPath(exportPath);
    setLocalExportStrategy(exportStrategy);
    closeModal();
  };

  const handleOverlayClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      handleCancel();
    }
  };

  const handleOverlayKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
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
          <button className="modal-close" onClick={handleCancel}>
            <CloseIcon />
          </button>
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
              <button className="settings-browse-button" onClick={handleBrowse}>
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
          <button className="modal-button secondary" onClick={handleCancel}>
            Отмена
          </button>
          <button className="modal-button primary" onClick={handleExport}>
            Экспортировать
          </button>
        </div>
      </div>
    </div>
  );
};
