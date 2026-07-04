import CloseIcon from '@mui/icons-material/Close';
import React, { useState, useEffect, useRef, useCallback } from 'react';

import { SettingsImportConfirmDialog } from '@app/components/SettingsImportConfirmDialog';
import { APP_VERSION } from '@shared/config';
import { getPlatformUnavailableMessage, usePlatformCapabilities } from '@shared/platform';
import {
  applySettingsImport,
  exportSettingsBundle,
  loadSettingsBundleViaNativeDialog,
  parseSettingsBundleJson,
  type SettingsExportBundle,
} from '@shared/services/settingsExportService';
import { useAimpStore, useSettingsStore, useUIStore, useProjectStore } from '@shared/stores';
import { getAimpAvailability } from '@shared/utils';
import { AudioDevice, getAudioOutputDevices, getDefaultDeviceId } from '@shared/utils/audioDevices';

const DIVIDER_INTERVALS = [
  { value: 900, label: '15 минут' },
  { value: 1800, label: '30 минут' },
  { value: 3600, label: '1 час' },
  { value: 7200, label: '2 часа' },
  { value: 10800, label: '3 часа' },
];

export const SettingsModal: React.FC = () => {
  const { modal, closeModal, addNotification } = useUIStore();
  const projectSettings = useProjectStore((s) => s.settings);
  const projectMeta = useProjectStore((s) => s.meta);
  const setPortableMode = useProjectStore((s) => s.setPortableMode);
  const hasHydrated = useSettingsStore((s) => s._hasHydrated);
  const {
    trackItemSizePreset,
    setTrackItemSizePreset,
    hourDividerInterval,
    setHourDividerInterval,
    showHourDividers,
    setShowHourDividers,
    playerAudioDeviceId,
    demoPlayerAudioDeviceId,
    setPlayerAudioDeviceId,
    setDemoPlayerAudioDeviceId,
    enableStreaming,
    setEnableStreaming,
    streamingSource,
    setStreamingSource,
  } = useSettingsStore();
  const aimpBridgeState = useAimpStore((state) => state.bridgeState);
  const aimpAvailability = getAimpAvailability(aimpBridgeState);
  const { supportsAimpWorkspace, supportsAudioDeviceSelection, supportsNativeFileSystem } =
    usePlatformCapabilities();
  const canSelectAimpSource = supportsAimpWorkspace && aimpAvailability.available;

  const [importConfirmOpen, setImportConfirmOpen] = useState(false);
  const [pendingImportBundle, setPendingImportBundle] = useState<SettingsExportBundle | null>(null);
  const [exportInProgress, setExportInProgress] = useState(false);
  const [importInProgress, setImportInProgress] = useState(false);
  const importFileInputRef = useRef<HTMLInputElement>(null);

  const [localTrackItemSizePreset, setLocalTrackItemSizePreset] = useState(trackItemSizePreset);
  const [localHourDividerInterval, setLocalHourDividerInterval] = useState(hourDividerInterval);
  const [localShowHourDividers, setLocalShowHourDividers] = useState(showHourDividers);
  const [localPlayerDeviceId, setLocalPlayerDeviceId] = useState<string | null>(
    playerAudioDeviceId,
  );
  const [localDemoPlayerDeviceId, setLocalDemoPlayerDeviceId] = useState<string | null>(
    demoPlayerAudioDeviceId,
  );
  const [localEnableStreaming, setLocalEnableStreaming] = useState(false);
  const [localStreamingSource, setLocalStreamingSource] = useState(streamingSource);

  const [audioDevices, setAudioDevices] = useState<AudioDevice[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);

  const prevModalRef = useRef(modal);

  useEffect(() => {
    if (modal === 'settings' && prevModalRef.current !== 'settings') {
      const timeoutId = setTimeout(() => {
        setLoadingDevices(true);
        getAudioOutputDevices()
          .then((devices) => {
            setAudioDevices(devices);
            setLoadingDevices(false);
          })
          .catch((error) => {
            console.error('Failed to load audio devices', error);
            setLoadingDevices(false);
          });
      }, 0);
      return () => clearTimeout(timeoutId);
    }
  }, [modal]);

  useEffect(() => {
    if (modal === 'settings' && prevModalRef.current !== 'settings') {
      prevModalRef.current = 'settings';
      const timeoutId = setTimeout(() => {
        setLocalTrackItemSizePreset(trackItemSizePreset);
        setLocalHourDividerInterval(hourDividerInterval);
        setLocalShowHourDividers(showHourDividers);
        setLocalPlayerDeviceId(playerAudioDeviceId);
        setLocalDemoPlayerDeviceId(demoPlayerAudioDeviceId);
        if (hasHydrated) {
          setLocalEnableStreaming(enableStreaming);
          setLocalStreamingSource(streamingSource);
        }
      }, 0);
      return () => clearTimeout(timeoutId);
    }
    prevModalRef.current = modal;
  }, [
    modal,
    hasHydrated,
    trackItemSizePreset,
    hourDividerInterval,
    showHourDividers,
    playerAudioDeviceId,
    demoPlayerAudioDeviceId,
    enableStreaming,
    streamingSource,
  ]);

  const syncLocalStateFromStore = useCallback(() => {
    const state = useSettingsStore.getState();
    setLocalTrackItemSizePreset(state.trackItemSizePreset);
    setLocalHourDividerInterval(state.hourDividerInterval);
    setLocalShowHourDividers(state.showHourDividers);
    setLocalPlayerDeviceId(state.playerAudioDeviceId);
    setLocalDemoPlayerDeviceId(state.demoPlayerAudioDeviceId);
    setLocalEnableStreaming(state.enableStreaming);
    setLocalStreamingSource(state.streamingSource);
  }, []);

  const formatImportSummary = useCallback((result: ReturnType<typeof applySettingsImport>) => {
    const workspaceParts: string[] = [];
    if (result.workspacesImported > 0) {
      workspaceParts.push(`добавлено ${result.workspacesImported}`);
    }
    if (result.workspacesUpdated > 0) {
      workspaceParts.push(`обновлено ${result.workspacesUpdated}`);
    }
    const workspaceSummary =
      workspaceParts.length > 0 ? workspaceParts.join(', ') : 'без изменений workspace';
    return `Импортировано полей настроек: ${result.settingsFieldCount}; workspace: ${workspaceSummary}`;
  }, []);

  const beginImport = useCallback((bundle: SettingsExportBundle) => {
    setPendingImportBundle(bundle);
    setImportConfirmOpen(true);
  }, []);

  const handleExportSettings = useCallback(async () => {
    if (exportInProgress) {
      return;
    }

    setExportInProgress(true);
    try {
      const outcome = await exportSettingsBundle();
      if (outcome === 'exported') {
        addNotification({ type: 'success', message: 'Резервная копия настроек экспортирована' });
      }
    } catch (error) {
      console.error('Settings export failed', error);
      addNotification({
        type: 'error',
        message: error instanceof Error ? error.message : 'Не удалось экспортировать настройки',
      });
    } finally {
      setExportInProgress(false);
    }
  }, [addNotification, exportInProgress]);

  const handleImportSettings = useCallback(async () => {
    if (importInProgress) {
      return;
    }

    if (supportsNativeFileSystem) {
      setImportInProgress(true);
      try {
        const bundle = await loadSettingsBundleViaNativeDialog();
        if (bundle) {
          beginImport(bundle);
        }
      } catch (error) {
        console.error('Settings import failed', error);
        addNotification({
          type: 'error',
          message: error instanceof Error ? error.message : 'Не удалось импортировать настройки',
        });
      } finally {
        setImportInProgress(false);
      }
      return;
    }

    importFileInputRef.current?.click();
  }, [addNotification, beginImport, importInProgress, supportsNativeFileSystem]);

  const handleImportFileSelected = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) {
        return;
      }

      setImportInProgress(true);
      try {
        const text = await file.text();
        const bundle = parseSettingsBundleJson(text);
        beginImport(bundle);
      } catch (error) {
        console.error('Settings import parse failed', error);
        addNotification({
          type: 'error',
          message: error instanceof Error ? error.message : 'Не удалось прочитать файл настроек',
        });
      } finally {
        setImportInProgress(false);
      }
    },
    [addNotification, beginImport],
  );

  const handleImportConfirm = useCallback(() => {
    if (!pendingImportBundle) {
      setImportConfirmOpen(false);
      return;
    }

    try {
      const result = applySettingsImport(pendingImportBundle);
      syncLocalStateFromStore();
      addNotification({ type: 'success', message: formatImportSummary(result) });
    } catch (error) {
      console.error('Settings import apply failed', error);
      addNotification({
        type: 'error',
        message: error instanceof Error ? error.message : 'Не удалось применить настройки',
      });
    } finally {
      setPendingImportBundle(null);
      setImportConfirmOpen(false);
    }
  }, [addNotification, formatImportSummary, pendingImportBundle, syncLocalStateFromStore]);

  const handleImportCancel = useCallback(() => {
    setPendingImportBundle(null);
    setImportConfirmOpen(false);
  }, []);

  if (modal !== 'settings') {
    return null;
  }

  const handleSave = () => {
    setTrackItemSizePreset(localTrackItemSizePreset);
    setHourDividerInterval(localHourDividerInterval);
    setShowHourDividers(localShowHourDividers);

    setPlayerAudioDeviceId(localPlayerDeviceId);
    setDemoPlayerAudioDeviceId(localDemoPlayerDeviceId);
    setEnableStreaming(localEnableStreaming);
    setStreamingSource(localStreamingSource);

    addNotification({ type: 'success', message: 'Настройки сохранены' });
    closeModal();
  };

  const handleCancel = () => {
    setLocalTrackItemSizePreset(trackItemSizePreset);
    setLocalHourDividerInterval(hourDividerInterval);
    setLocalShowHourDividers(showHourDividers);
    setLocalPlayerDeviceId(playerAudioDeviceId);
    setLocalDemoPlayerDeviceId(demoPlayerAudioDeviceId);
    setLocalEnableStreaming(enableStreaming);
    setLocalStreamingSource(streamingSource);
    closeModal();
  };

  const handleOverlayClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      handleCancel();
    }
  };

  const handleOverlayKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleCancel();
    }
  };

  return (
    <>
      <div
        className="modal-overlay"
        onClick={handleOverlayClick}
        onKeyDown={handleOverlayKeyDown}
        role="button"
        tabIndex={0}
        aria-label="Close settings modal"
      >
        <div className="modal-content">
          <div className="modal-header">
            <h2 className="modal-title">Настройки</h2>
            <button className="modal-close" onClick={handleCancel}>
              <CloseIcon />
            </button>
          </div>

          <div className="modal-body">
            <div className="settings-group">
              <label className="settings-label" htmlFor="settings-track-size">
                Размер строк треков
              </label>
              <select
                className="settings-select"
                value={localTrackItemSizePreset}
                onChange={(e) =>
                  setLocalTrackItemSizePreset(e.target.value as 'small' | 'medium' | 'large')
                }
                id="settings-track-size"
              >
                <option value="small">Маленькие</option>
                <option value="medium">Средние</option>
                <option value="large">Большие</option>
              </select>
            </div>

            <div className="settings-group">
              <div className="settings-checkbox-group">
                <input
                  type="checkbox"
                  className="settings-checkbox"
                  checked={localShowHourDividers}
                  onChange={(e) => setLocalShowHourDividers(e.target.checked)}
                  id="settings-show-dividers"
                />
                <label className="settings-checkbox-label" htmlFor="settings-show-dividers">
                  Показывать отсечки в плейлисте
                </label>
              </div>
            </div>

            <hr className="settings-divider" style={{ marginTop: 16, marginBottom: 12 }} />

            <div
              className="settings-section-title"
              style={{ marginBottom: 8, fontWeight: 600, fontSize: '0.95rem' }}
            >
              Онлайн
            </div>

            <div className="settings-group">
              <div className="settings-checkbox-group">
                <input
                  type="checkbox"
                  className="settings-checkbox"
                  checked={localEnableStreaming}
                  onChange={(e) => setLocalEnableStreaming(e.target.checked)}
                  id="settings-enable-streaming"
                />
                <label className="settings-checkbox-label" htmlFor="settings-enable-streaming">
                  Онлайн
                </label>
              </div>
              <div
                className="settings-description"
                style={{
                  marginTop: 4,
                  fontSize: '0.85rem',
                  color: 'var(--text-secondary, #9e9e9e)',
                }}
              >
                {localEnableStreaming
                  ? 'Связь с сервером и страницей для гостей.'
                  : 'Работа без сети — запросы к серверу не выполняются.'}
              </div>
            </div>

            <div
              className="settings-section-title"
              style={{ marginTop: 12, marginBottom: 8, fontWeight: 600, fontSize: '0.95rem' }}
            >
              Синхронизация с сайтом
            </div>

            <div className="settings-group">
              <label className="settings-label" htmlFor="settings-streaming-source">
                Источник состояния для гостей
              </label>
              <select
                className="settings-select"
                value={localStreamingSource}
                onChange={(e) =>
                  setLocalStreamingSource(e.target.value as 'cherryPlayPlayer' | 'aimp')
                }
                id="settings-streaming-source"
                disabled={!localEnableStreaming}
              >
                <option value="cherryPlayPlayer">CherryPlay</option>
                <option value="aimp" disabled={!canSelectAimpSource}>
                  AIMP
                </option>
              </select>
            </div>

            {!canSelectAimpSource && (
              <div
                className="settings-description"
                style={{
                  marginTop: 4,
                  fontSize: '0.85rem',
                  color: 'var(--text-secondary, #9e9e9e)',
                  display: 'grid',
                  gap: 4,
                }}
              >
                {!supportsAimpWorkspace ? (
                  <div>{getPlatformUnavailableMessage()}</div>
                ) : (
                  <>
                    <div>AIMP режим сейчас недоступен:</div>
                    {aimpAvailability.gatingReasons.map((reason) => (
                      <div key={reason.code}>- {reason.message}</div>
                    ))}
                  </>
                )}
              </div>
            )}

            <div className="settings-group">
              <label className="settings-label" htmlFor="settings-hour-divider">
                Интервал отсечек в плейлисте
              </label>
              <select
                className="settings-select"
                value={localHourDividerInterval}
                onChange={(e) => setLocalHourDividerInterval(Number(e.target.value))}
                id="settings-hour-divider"
                disabled={!localShowHourDividers}
              >
                {DIVIDER_INTERVALS.map((interval) => (
                  <option key={interval.value} value={interval.value}>
                    {interval.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="settings-group">
              <label className="settings-label" htmlFor="player-audio-device">
                Куда играет CherryPlay
              </label>
              {loadingDevices ? (
                <div className="settings-loading">Загрузка устройств...</div>
              ) : (
                <select
                  className="settings-select"
                  value={localPlayerDeviceId || getDefaultDeviceId()}
                  onChange={(e) => {
                    const value = e.target.value;
                    setLocalPlayerDeviceId(value === getDefaultDeviceId() ? null : value);
                  }}
                  id="player-audio-device"
                  disabled={!supportsAudioDeviceSelection}
                >
                  <option value={getDefaultDeviceId()}>По умолчанию</option>
                  {audioDevices.map((device) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label}
                    </option>
                  ))}
                </select>
              )}
              {!supportsAudioDeviceSelection && (
                <div
                  className="settings-description"
                  style={{
                    marginTop: 4,
                    fontSize: '0.85rem',
                    color: 'var(--text-secondary, #9e9e9e)',
                  }}
                >
                  {getPlatformUnavailableMessage()}
                </div>
              )}
            </div>

            <div className="settings-group">
              <label className="settings-label" htmlFor="demo-player-audio-device">
                Куда играет прослушивание файлов
              </label>
              {loadingDevices ? (
                <div className="settings-loading">Загрузка устройств...</div>
              ) : (
                <select
                  className="settings-select"
                  value={localDemoPlayerDeviceId || getDefaultDeviceId()}
                  onChange={(e) => {
                    const value = e.target.value;
                    setLocalDemoPlayerDeviceId(value === getDefaultDeviceId() ? null : value);
                  }}
                  id="demo-player-audio-device"
                  disabled={!supportsAudioDeviceSelection}
                >
                  <option value={getDefaultDeviceId()}>По умолчанию</option>
                  {audioDevices.map((device) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label}
                    </option>
                  ))}
                </select>
              )}
              {!supportsAudioDeviceSelection && (
                <div
                  className="settings-description"
                  style={{
                    marginTop: 4,
                    fontSize: '0.85rem',
                    color: 'var(--text-secondary, #9e9e9e)',
                  }}
                >
                  {getPlatformUnavailableMessage()}
                </div>
              )}
            </div>

            <hr className="settings-divider" style={{ marginTop: 16, marginBottom: 12 }} />

            <div
              className="settings-section-title"
              style={{ marginBottom: 8, fontWeight: 600, fontSize: '0.95rem' }}
            >
              Настройки проекта
            </div>

            <div
              className="settings-group"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <div
                className="settings-checkbox-group"
                style={{ display: 'flex', alignItems: 'center', gap: 8 }}
              >
                <input
                  type="checkbox"
                  className="settings-checkbox"
                  checked={!!projectSettings?.portableMode}
                  onChange={(e) => setPortableMode(e.target.checked)}
                  id="settings-portable-mode"
                  disabled={!projectMeta.filePath}
                />
                <label
                  className="settings-checkbox-label"
                  htmlFor="settings-portable-mode"
                  style={!projectMeta.filePath ? { opacity: 0.5 } : undefined}
                >
                  Портативный режим
                </label>
              </div>

              <span
                className="settings-info-icon"
                title="При сохранении треки копируются в папку tracks/ рядом с файлом проекта. Позволяет перенести проект на другой компьютер."
                style={{
                  cursor: 'help',
                  fontSize: 14,
                  color: 'var(--text-secondary, #9e9e9e)',
                  padding: '2px 6px',
                  borderRadius: 999,
                  border: '1px solid var(--border-subtle, rgba(255,255,255,0.12))',
                }}
              >
                i
              </span>
            </div>

            {!projectMeta.filePath && (
              <div
                className="settings-description"
                style={{
                  marginTop: 4,
                  fontStyle: 'italic',
                  fontSize: '0.85rem',
                  color: 'var(--text-secondary, #9e9e9e)',
                }}
              >
                Сначала сохраните проект в файл, чтобы включить портативный режим.
              </div>
            )}

            <hr className="settings-divider" style={{ marginTop: 16, marginBottom: 12 }} />

            <div
              className="settings-section-title"
              style={{ marginBottom: 8, fontWeight: 600, fontSize: '0.95rem' }}
            >
              Резервная копия настроек
            </div>

            <div
              className="settings-group"
              style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}
            >
              <button
                type="button"
                className="modal-button secondary"
                onClick={() => void handleExportSettings()}
                disabled={exportInProgress}
              >
                Экспорт…
              </button>
              <button
                type="button"
                className="modal-button secondary"
                onClick={() => void handleImportSettings()}
                disabled={importInProgress}
              >
                Импорт…
              </button>
              <input
                ref={importFileInputRef}
                type="file"
                accept="application/json,.json"
                style={{ display: 'none' }}
                onChange={(event) => void handleImportFileSelected(event)}
              />
            </div>

            {!supportsNativeFileSystem && (
              <div
                className="settings-description"
                style={{
                  marginTop: 4,
                  fontSize: '0.85rem',
                  color: 'var(--text-secondary, #9e9e9e)',
                }}
              >
                В веб-демо экспорт скачивает JSON-файл, импорт — через выбор файла в браузере.{' '}
                {getPlatformUnavailableMessage()}
              </div>
            )}

            <div className="settings-version">Версия {APP_VERSION}</div>
          </div>

          <div className="modal-footer">
            <button className="modal-button secondary" onClick={handleCancel}>
              Отмена
            </button>
            <button className="modal-button primary" onClick={handleSave}>
              Сохранить
            </button>
          </div>
        </div>
      </div>

      <SettingsImportConfirmDialog
        open={importConfirmOpen}
        onClose={handleImportCancel}
        onConfirm={handleImportConfirm}
      />
    </>
  );
};
