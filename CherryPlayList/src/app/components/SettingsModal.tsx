import { Button, IconButton, InfoIcon } from '@cherryplay/components';
import CloseIcon from '@mui/icons-material/Close';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import React, { useState, useEffect, useRef, useCallback } from 'react';

import { SettingsImportConfirmDialog } from '@app/components/SettingsImportConfirmDialog';
import { APP_VERSION } from '@shared/config';
import {
  LOUDNESS_QUIET_GAP_PRESETS,
  MAX_LOUDNESS_QUIET_GAP_RANGE_LU,
  MIN_LOUDNESS_QUIET_GAP_RANGE_LU,
  resolveQuietGapRangePercent,
} from '@shared/contracts/loudness';
import { useModalKeyboard } from '@shared/hooks';
import { getPlatformUnavailableMessage, usePlatformCapabilities } from '@shared/platform';
import {
  applySettingsImport,
  exportSettingsBundle,
  loadSettingsBundleViaNativeDialog,
  parseSettingsBundleJson,
  type SettingsExportBundle,
} from '@shared/services/settingsExportService';
import {
  useAimpStore,
  useProjectStore,
  useSettingsStore,
  useUIStore,
  type TrackItemSizePreset,
} from '@shared/stores';
import { getAimpAvailability } from '@shared/utils';
import { AudioDevice, getAudioOutputDevices, getDefaultDeviceId } from '@shared/utils/audioDevices';

const DIVIDER_INTERVALS = [
  { value: 900, label: '15 минут' },
  { value: 1800, label: '30 минут' },
  { value: 3600, label: '1 час' },
  { value: 7200, label: '2 часа' },
  { value: 10800, label: '3 часа' },
];

const LOUDNESS_QUIET_GAP_LABEL = 'Терпимость к провалам громкости';

const HINT_LOUDNESS_QUIET_GAP = [
  'Порог в LU: насколько глубокий провал относительно целевой громкости приложение терпит, прежде чем включить полную компрессию тихих участков.',
  'Меньше LU (ближе к 5) — компрессия включается раньше и сильнее: тихие места подтягиваются, контраст с громкими частями меньше.',
  'Больше LU (ближе к 30) — терпим более глубокие провалы: компрессия мягче, больше динамики. Не «сила подъёма», а «насколько глубокий провал ещё допустим».',
  'Пресеты на шкале — быстрые точки; между ними можно выбрать любое значение.',
].join(' ');

type SettingsFieldInfoIconProps = {
  hint: string;
  label: string;
};

function SettingsFieldInfoIcon({ hint, label }: SettingsFieldInfoIconProps) {
  return (
    <button
      type="button"
      className="settings-field-info"
      title={hint}
      aria-label={`${label}: ${hint}`}
    >
      <InfoOutlinedIcon className="settings-field-info__icon" aria-hidden />
    </button>
  );
}

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
    playerInAppHeader,
    setPlayerInAppHeader,
    enableStreaming,
    setEnableStreaming,
    streamingSource,
    setStreamingSource,
    loudnessNormalizationEnabled,
    loudnessTargetLufs,
    loudnessCompressionEnabled,
    loudnessQuietGapRangeLu,
    setLoudnessNormalizationEnabled,
    setLoudnessTargetLufs,
    setLoudnessCompressionEnabled,
    setLoudnessQuietGapRangeLu,
  } = useSettingsStore();
  const aimpBridgeState = useAimpStore((state) => state.bridgeState);
  const aimpAvailability = getAimpAvailability(aimpBridgeState);
  const {
    supportsAimpWorkspace,
    supportsAudioDeviceSelection,
    supportsLoudnessAnalysis,
    supportsNativeFileSystem,
  } = usePlatformCapabilities();
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
  const [localPlayerInAppHeader, setLocalPlayerInAppHeader] = useState(playerInAppHeader);
  const [localEnableStreaming, setLocalEnableStreaming] = useState(false);
  const [localStreamingSource, setLocalStreamingSource] = useState(streamingSource);
  const [localLoudnessNormalizationEnabled, setLocalLoudnessNormalizationEnabled] = useState(
    loudnessNormalizationEnabled,
  );
  const [localLoudnessTargetLufs, setLocalLoudnessTargetLufs] = useState(
    String(loudnessTargetLufs),
  );
  const [localLoudnessCompressionEnabled, setLocalLoudnessCompressionEnabled] = useState(
    loudnessCompressionEnabled,
  );
  const [localLoudnessQuietGapRangeLu, setLocalLoudnessQuietGapRangeLu] =
    useState(loudnessQuietGapRangeLu);

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
        setLocalPlayerInAppHeader(playerInAppHeader);
        if (hasHydrated) {
          setLocalEnableStreaming(enableStreaming);
          setLocalStreamingSource(streamingSource);
        }
        setLocalLoudnessNormalizationEnabled(loudnessNormalizationEnabled);
        setLocalLoudnessTargetLufs(String(loudnessTargetLufs));
        setLocalLoudnessCompressionEnabled(loudnessCompressionEnabled);
        setLocalLoudnessQuietGapRangeLu(loudnessQuietGapRangeLu);
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
    playerInAppHeader,
    enableStreaming,
    streamingSource,
    loudnessNormalizationEnabled,
    loudnessTargetLufs,
    loudnessCompressionEnabled,
    loudnessQuietGapRangeLu,
  ]);

  const syncLocalStateFromStore = useCallback(() => {
    const state = useSettingsStore.getState();
    setLocalTrackItemSizePreset(state.trackItemSizePreset);
    setLocalHourDividerInterval(state.hourDividerInterval);
    setLocalShowHourDividers(state.showHourDividers);
    setLocalPlayerDeviceId(state.playerAudioDeviceId);
    setLocalDemoPlayerDeviceId(state.demoPlayerAudioDeviceId);
    setLocalPlayerInAppHeader(state.playerInAppHeader);
    setLocalEnableStreaming(state.enableStreaming);
    setLocalStreamingSource(state.streamingSource);
    setLocalLoudnessNormalizationEnabled(state.loudnessNormalizationEnabled);
    setLocalLoudnessTargetLufs(String(state.loudnessTargetLufs));
    setLocalLoudnessCompressionEnabled(state.loudnessCompressionEnabled);
    setLocalLoudnessQuietGapRangeLu(state.loudnessQuietGapRangeLu);
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

  const handleSave = useCallback(() => {
    setTrackItemSizePreset(localTrackItemSizePreset);
    setHourDividerInterval(localHourDividerInterval);
    setShowHourDividers(localShowHourDividers);

    setPlayerAudioDeviceId(localPlayerDeviceId);
    setDemoPlayerAudioDeviceId(localDemoPlayerDeviceId);
    setPlayerInAppHeader(localPlayerInAppHeader);
    setEnableStreaming(localEnableStreaming);
    setStreamingSource(localStreamingSource);
    setLoudnessNormalizationEnabled(localLoudnessNormalizationEnabled);
    const parsedTargetLufs = Number(localLoudnessTargetLufs);
    setLoudnessTargetLufs(Number.isFinite(parsedTargetLufs) ? parsedTargetLufs : -18);
    setLoudnessCompressionEnabled(localLoudnessCompressionEnabled);
    setLoudnessQuietGapRangeLu(localLoudnessQuietGapRangeLu);

    addNotification({ type: 'success', message: 'Настройки сохранены' });
    closeModal();
  }, [
    addNotification,
    closeModal,
    localDemoPlayerDeviceId,
    localEnableStreaming,
    localHourDividerInterval,
    localPlayerDeviceId,
    localPlayerInAppHeader,
    localLoudnessCompressionEnabled,
    localLoudnessNormalizationEnabled,
    localLoudnessQuietGapRangeLu,
    localLoudnessTargetLufs,
    localShowHourDividers,
    localStreamingSource,
    localTrackItemSizePreset,
    setDemoPlayerAudioDeviceId,
    setEnableStreaming,
    setHourDividerInterval,
    setPlayerAudioDeviceId,
    setPlayerInAppHeader,
    setLoudnessCompressionEnabled,
    setLoudnessNormalizationEnabled,
    setLoudnessQuietGapRangeLu,
    setLoudnessTargetLufs,
    setShowHourDividers,
    setStreamingSource,
    setTrackItemSizePreset,
  ]);

  const handleCancel = useCallback(() => {
    setLocalTrackItemSizePreset(trackItemSizePreset);
    setLocalHourDividerInterval(hourDividerInterval);
    setLocalShowHourDividers(showHourDividers);
    setLocalPlayerDeviceId(playerAudioDeviceId);
    setLocalDemoPlayerDeviceId(demoPlayerAudioDeviceId);
    setLocalPlayerInAppHeader(playerInAppHeader);
    setLocalEnableStreaming(enableStreaming);
    setLocalStreamingSource(streamingSource);
    setLocalLoudnessNormalizationEnabled(loudnessNormalizationEnabled);
    setLocalLoudnessTargetLufs(String(loudnessTargetLufs));
    setLocalLoudnessCompressionEnabled(loudnessCompressionEnabled);
    setLocalLoudnessQuietGapRangeLu(loudnessQuietGapRangeLu);
    closeModal();
  }, [
    closeModal,
    demoPlayerAudioDeviceId,
    enableStreaming,
    hourDividerInterval,
    loudnessCompressionEnabled,
    loudnessNormalizationEnabled,
    loudnessQuietGapRangeLu,
    loudnessTargetLufs,
    playerAudioDeviceId,
    playerInAppHeader,
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

  const loudnessQuietGapDisabled =
    !localLoudnessNormalizationEnabled ||
    !localLoudnessCompressionEnabled ||
    !supportsLoudnessAnalysis;

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
                <option value="xsmall">Ультра маленькие</option>
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

            <div className="settings-group">
              <label className="settings-label" htmlFor="settings-streaming-source">
                Источник состояния воспроизведения
              </label>
              <select
                className="settings-select"
                value={localStreamingSource}
                onChange={(event) =>
                  setLocalStreamingSource(event.target.value as 'cherryPlayPlayer' | 'aimp')
                }
                id="settings-streaming-source"
              >
                <option value="cherryPlayPlayer">CherryPlay Player</option>
                <option value="aimp" disabled={!canSelectAimpSource}>
                  AIMP
                </option>
              </select>
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

            <div className="settings-group">
              <div className="settings-checkbox-group">
                <input
                  type="checkbox"
                  className="settings-checkbox"
                  checked={localPlayerInAppHeader}
                  onChange={(e) => setLocalPlayerInAppHeader(e.target.checked)}
                  id="settings-player-in-header"
                />
                <label className="settings-checkbox-label" htmlFor="settings-player-in-header">
                  Показывать плеер в шапке
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
                Компактная панель проигрывания в шапке вместо зоны «Проигрывание» в layout.
              </div>
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

              <InfoIcon
                className="settings-info-icon"
                title="При сохранении треки копируются в папку tracks/ рядом с файлом проекта. Позволяет перенести проект на другой компьютер."
              />
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

            <hr className="settings-divider" style={{ marginTop: 16, marginBottom: 12 }} />

            <div
              className="settings-section-title"
              style={{ marginBottom: 8, fontWeight: 600, fontSize: '0.95rem' }}
            >
              Нормализация громкости
            </div>

            <div className="settings-group">
              <div className="settings-checkbox-group">
                <input
                  type="checkbox"
                  className="settings-checkbox"
                  checked={localLoudnessNormalizationEnabled}
                  onChange={(e) => setLocalLoudnessNormalizationEnabled(e.target.checked)}
                  id="settings-loudness-enabled"
                  disabled={!supportsLoudnessAnalysis}
                />
                <label
                  className="settings-checkbox-label"
                  htmlFor="settings-loudness-enabled"
                  style={!supportsLoudnessAnalysis ? { opacity: 0.5 } : undefined}
                >
                  Включить нормализацию громкости
                </label>
              </div>
            </div>

            {!supportsLoudnessAnalysis && (
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

            <div className="settings-group">
              <label className="settings-label" htmlFor="settings-loudness-target">
                Целевая громкость (LUFS)
              </label>
              <input
                type="number"
                className="settings-select"
                id="settings-loudness-target"
                value={localLoudnessTargetLufs}
                onChange={(e) => setLocalLoudnessTargetLufs(e.target.value)}
                disabled={!localLoudnessNormalizationEnabled || !supportsLoudnessAnalysis}
                step={0.5}
                max={0}
              />
            </div>

            <div className="settings-group">
              <div className="settings-checkbox-group">
                <input
                  type="checkbox"
                  className="settings-checkbox"
                  checked={localLoudnessCompressionEnabled}
                  onChange={(e) => setLocalLoudnessCompressionEnabled(e.target.checked)}
                  id="settings-loudness-compression"
                  disabled={!localLoudnessNormalizationEnabled || !supportsLoudnessAnalysis}
                />
                <label
                  className="settings-checkbox-label"
                  htmlFor="settings-loudness-compression"
                  style={
                    !localLoudnessNormalizationEnabled || !supportsLoudnessAnalysis
                      ? { opacity: 0.5 }
                      : undefined
                  }
                >
                  Адаптивная компрессия (LRA и тихие участки, до gain)
                </label>
              </div>
            </div>

            <div className="settings-group">
              <div className="settings-quiet-gap">
                <div className="settings-quiet-gap__header">
                  <div className="settings-label-with-info">
                    <label htmlFor="settings-loudness-quiet-gap">{LOUDNESS_QUIET_GAP_LABEL}</label>
                    <SettingsFieldInfoIcon
                      label={LOUDNESS_QUIET_GAP_LABEL}
                      hint={HINT_LOUDNESS_QUIET_GAP}
                    />
                  </div>
                  <span className="settings-quiet-gap__value">
                    {localLoudnessQuietGapRangeLu} LU
                  </span>
                </div>
                <input
                  id="settings-loudness-quiet-gap"
                  type="range"
                  className="settings-quiet-gap__slider"
                  min={MIN_LOUDNESS_QUIET_GAP_RANGE_LU}
                  max={MAX_LOUDNESS_QUIET_GAP_RANGE_LU}
                  step={1}
                  value={localLoudnessQuietGapRangeLu}
                  disabled={loudnessQuietGapDisabled}
                  onChange={(event) => setLocalLoudnessQuietGapRangeLu(Number(event.target.value))}
                />
                <div className="settings-quiet-gap__scale" aria-hidden>
                  <span className="settings-quiet-gap__scale-end">
                    <span className="settings-quiet-gap__scale-value">
                      {MIN_LOUDNESS_QUIET_GAP_RANGE_LU} LU
                    </span>
                    <span className="settings-quiet-gap__scale-hint">сильнее компрессия</span>
                  </span>
                  <span className="settings-quiet-gap__scale-end settings-quiet-gap__scale-end--right">
                    <span className="settings-quiet-gap__scale-value">
                      {MAX_LOUDNESS_QUIET_GAP_RANGE_LU} LU
                    </span>
                    <span className="settings-quiet-gap__scale-hint">больше динамики</span>
                  </span>
                </div>
                <div className="settings-quiet-gap__presets">
                  {LOUDNESS_QUIET_GAP_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      className={`settings-quiet-gap__preset${
                        localLoudnessQuietGapRangeLu === preset.value
                          ? ' settings-quiet-gap__preset--active'
                          : ''
                      }`}
                      style={{ left: `${resolveQuietGapRangePercent(preset.value)}%` }}
                      disabled={loudnessQuietGapDisabled}
                      onClick={() => setLocalLoudnessQuietGapRangeLu(preset.value)}
                    >
                      <span className="settings-quiet-gap__preset-tick" />
                      <span className="settings-quiet-gap__preset-label">{preset.label}</span>
                      <span className="settings-quiet-gap__preset-value">{preset.value}</span>
                    </button>
                  ))}
                </div>
              </div>
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
