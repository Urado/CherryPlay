import { Button, IconButton } from '@cherryplay/components';
import CloseIcon from '@mui/icons-material/Close';
import React, { useState, useEffect, useRef, useCallback } from 'react';

import { SettingsImportConfirmDialog } from '@app/components/SettingsImportConfirmDialog';
import { APP_VERSION } from '@shared/config';
import type { AimpSourceSelection } from '@shared/contracts/aimp';
import { useModalKeyboard } from '@shared/hooks';
import { getPlatformUnavailableMessage, usePlatformCapabilities } from '@shared/platform';
import {
  applySettingsImport,
  exportSettingsBundle,
  loadSettingsBundleViaNativeDialog,
  parseSettingsBundleJson,
  type SettingsExportBundle,
} from '@shared/services/settingsExportService';
import { useAimpStore, useSettingsStore, useUIStore } from '@shared/stores';
import type { TrackItemSizePreset } from '@shared/types/trackItemSize';
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
  const bridgeState = useAimpStore((state) => state.bridgeState);
  const { supportsAudioDeviceSelection, supportsNativeFileSystem, supportsAimpWorkspace } =
    usePlatformCapabilities();
  const aimpAvailability = getAimpAvailability(bridgeState);
  const canSelectAimp = supportsAimpWorkspace && aimpAvailability.available;

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
  const [localStreamingSource, setLocalStreamingSource] =
    useState<AimpSourceSelection>(streamingSource);

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
      await exportSettingsBundle();
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

  const handleSave = useCallback(() => {
    setTrackItemSizePreset(localTrackItemSizePreset);
    setHourDividerInterval(localHourDividerInterval);
    setShowHourDividers(localShowHourDividers);

    setPlayerAudioDeviceId(localPlayerDeviceId);
    setDemoPlayerAudioDeviceId(localDemoPlayerDeviceId);
    setEnableStreaming(localEnableStreaming);
    setStreamingSource(
      localStreamingSource === 'aimp' && !canSelectAimp ? 'cherryPlayPlayer' : localStreamingSource,
    );

    addNotification({ type: 'success', message: 'Настройки сохранены' });
    closeModal();
  }, [
    canSelectAimp,
    closeModal,
    localDemoPlayerDeviceId,
    localEnableStreaming,
    localHourDividerInterval,
    localPlayerDeviceId,
    localShowHourDividers,
    localStreamingSource,
    localTrackItemSizePreset,
    setDemoPlayerAudioDeviceId,
    setEnableStreaming,
    setHourDividerInterval,
    setPlayerAudioDeviceId,
    setShowHourDividers,
    setStreamingSource,
    setTrackItemSizePreset,
    addNotification,
  ]);

  const handleCancel = useCallback(() => {
    setLocalTrackItemSizePreset(trackItemSizePreset);
    setLocalHourDividerInterval(hourDividerInterval);
    setLocalShowHourDividers(showHourDividers);
    setLocalPlayerDeviceId(playerAudioDeviceId);
    setLocalDemoPlayerDeviceId(demoPlayerAudioDeviceId);
    setLocalEnableStreaming(enableStreaming);
    setLocalStreamingSource(streamingSource);
    closeModal();
  }, [
    closeModal,
    demoPlayerAudioDeviceId,
    enableStreaming,
    hourDividerInterval,
    playerAudioDeviceId,
    showHourDividers,
    streamingSource,
    trackItemSizePreset,
  ]);

  const { handleOverlayKeyDown } = useModalKeyboard({
    enabled: modal === 'settings' && !importConfirmOpen,
    onCancel: handleCancel,
    onPrimary: handleSave,
  });

  if (modal !== 'settings') {
    return null;
  }

  const handleOverlayClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
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
              <label className="settings-label" htmlFor="settings-track-size">
                Размер строк треков
              </label>
              <select
                className="settings-select"
                value={localTrackItemSizePreset}
                onChange={(e) => setLocalTrackItemSizePreset(e.target.value as TrackItemSizePreset)}
                id="settings-track-size"
              >
                <option value="tiny">Крохотные</option>
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

            <hr className="settings-divider" style={{ marginTop: 16, marginBottom: 12 }} />

            <div
              className="settings-section-title"
              style={{ marginBottom: 8, fontWeight: 600, fontSize: '0.95rem' }}
            >
              Проигрывание
            </div>

            <div className="settings-group">
              <label className="settings-label" htmlFor="settings-streaming-source">
                Источник проигрывания
              </label>
              <select
                className="settings-select"
                id="settings-streaming-source"
                value={localStreamingSource}
                onChange={(e) => setLocalStreamingSource(e.target.value as AimpSourceSelection)}
              >
                <option value="cherryPlayPlayer">CherryPlay</option>
                <option value="aimp" disabled={!canSelectAimp && localStreamingSource !== 'aimp'}>
                  AIMP{!canSelectAimp ? ' (недоступен)' : ''}
                </option>
              </select>
              {!canSelectAimp && (
                <div
                  className="settings-description"
                  style={{
                    marginTop: 4,
                    fontSize: '0.85rem',
                    color: 'var(--text-secondary, #9e9e9e)',
                  }}
                >
                  {supportsAimpWorkspace
                    ? (aimpAvailability.gatingReasons[0]?.message ??
                      'AIMP сейчас недоступен на этой платформе.')
                    : 'AIMP доступен только в десктопном приложении.'}
                </div>
              )}
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
              Резервная копия настроек
            </div>

            <div
              className="settings-group"
              style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}
            >
              <Button
                type="button"
                className="modal-button"
                onClick={() => void handleExportSettings()}
                disabled={exportInProgress}
                variant="secondary"
                size="sm"
              >
                Экспорт…
              </Button>
              <Button
                type="button"
                className="modal-button"
                onClick={() => void handleImportSettings()}
                disabled={importInProgress}
                variant="secondary"
                size="sm"
              >
                Импорт…
              </Button>
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
              onClick={handleSave}
              variant="primary"
              size="sm"
            >
              Сохранить
            </Button>
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
