import CloseIcon from '@mui/icons-material/Close';
import React, { useState, useEffect, useRef } from 'react';

import { APP_VERSION } from '@shared/config';
import { getPlatformUnavailableMessage, usePlatformCapabilities } from '@shared/platform';
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
    loudnessNormalizationEnabled,
    loudnessTargetLufs,
    loudnessCompressionEnabled,
    setLoudnessNormalizationEnabled,
    setLoudnessTargetLufs,
    setLoudnessCompressionEnabled,
  } = useSettingsStore();
  const aimpBridgeState = useAimpStore((state) => state.bridgeState);
  const aimpAvailability = getAimpAvailability(aimpBridgeState);
  const { supportsAimpWorkspace, supportsAudioDeviceSelection, supportsLoudnessAnalysis } =
    usePlatformCapabilities();
  const canSelectAimpSource = supportsAimpWorkspace && aimpAvailability.available;

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
  const [localLoudnessNormalizationEnabled, setLocalLoudnessNormalizationEnabled] = useState(
    loudnessNormalizationEnabled,
  );
  const [localLoudnessTargetLufs, setLocalLoudnessTargetLufs] = useState(
    String(loudnessTargetLufs),
  );
  const [localLoudnessCompressionEnabled, setLocalLoudnessCompressionEnabled] = useState(
    loudnessCompressionEnabled,
  );

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
        setLocalLoudnessNormalizationEnabled(loudnessNormalizationEnabled);
        setLocalLoudnessTargetLufs(String(loudnessTargetLufs));
        setLocalLoudnessCompressionEnabled(loudnessCompressionEnabled);
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
    loudnessNormalizationEnabled,
    loudnessTargetLufs,
    loudnessCompressionEnabled,
  ]);

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
    setLoudnessNormalizationEnabled(localLoudnessNormalizationEnabled);
    const parsedTargetLufs = Number(localLoudnessTargetLufs);
    setLoudnessTargetLufs(Number.isFinite(parsedTargetLufs) ? parsedTargetLufs : -18);
    setLoudnessCompressionEnabled(localLoudnessCompressionEnabled);

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
    setLocalLoudnessNormalizationEnabled(loudnessNormalizationEnabled);
    setLocalLoudnessTargetLufs(String(loudnessTargetLufs));
    setLocalLoudnessCompressionEnabled(loudnessCompressionEnabled);
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
            Источник стриминга
          </div>

          <div className="settings-group">
            <label className="settings-label" htmlFor="settings-streaming-source">
              Источник состояния воспроизведения
            </label>
            <select
              className="settings-select"
              value={localStreamingSource}
              onChange={(e) =>
                setLocalStreamingSource(e.target.value as 'cherryPlayPlayer' | 'aimp')
              }
              id="settings-streaming-source"
            >
              <option value="cherryPlayPlayer">CherryPlay Player</option>
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
              Аудиоустройство для плеера
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
              Аудиоустройство для демо-плеера
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
                Адаптивная компрессия (зависит от gain и тихих участков)
              </label>
            </div>
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
                Включить стриминг
              </label>
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
  );
};
