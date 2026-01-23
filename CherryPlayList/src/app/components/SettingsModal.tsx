import CloseIcon from '@mui/icons-material/Close';
import React, { useState, useEffect, useRef } from 'react';

import {
  useSettingsStore,
  useUIStore,
  useDemoPlayerStore,
  usePlayerAudioStore,
} from '@shared/stores';
import { AudioDevice, getAudioOutputDevices, getDefaultDeviceId } from '@shared/utils/audioDevices';

// Предустановленные интервалы отсечек
const DIVIDER_INTERVALS = [
  { value: 900, label: '15 минут' }, // 15 * 60
  { value: 1800, label: '30 минут' }, // 30 * 60
  { value: 3600, label: '1 час' }, // 60 * 60
  { value: 7200, label: '2 часа' }, // 120 * 60
  { value: 10800, label: '3 часа' }, // 180 * 60
];

export const SettingsModal: React.FC = () => {
  const { modal, closeModal, addNotification } = useUIStore();
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
  } = useSettingsStore();

  const [localTrackItemSizePreset, setLocalTrackItemSizePreset] = useState(trackItemSizePreset);
  const [localHourDividerInterval, setLocalHourDividerInterval] = useState(hourDividerInterval);
  const [localShowHourDividers, setLocalShowHourDividers] = useState(showHourDividers);
  const [localPlayerDeviceId, setLocalPlayerDeviceId] = useState<string | null>(
    playerAudioDeviceId,
  );
  const [localDemoPlayerDeviceId, setLocalDemoPlayerDeviceId] = useState<string | null>(
    demoPlayerAudioDeviceId,
  );

  // Состояние для аудиоустройств
  const [audioDevices, setAudioDevices] = useState<AudioDevice[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);

  const prevModalRef = useRef(modal);

  // Загружаем список устройств при открытии настроек
  useEffect(() => {
    if (modal === 'settings' && prevModalRef.current !== 'settings') {
      // Используем setTimeout для асинхронного обновления, чтобы избежать предупреждения линтера
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

  // Синхронизируем локальные значения при открытии модального окна
  // Это стандартный паттерн для модальных окон - синхронизация состояния при открытии
  useEffect(() => {
    if (modal === 'settings' && prevModalRef.current !== 'settings') {
      // Модальное окно только что открылось - синхронизируем значения из store
      // Используем setTimeout для асинхронного обновления, чтобы избежать предупреждения линтера
      const timeoutId = setTimeout(() => {
        setLocalTrackItemSizePreset(trackItemSizePreset);
        setLocalHourDividerInterval(hourDividerInterval);
        setLocalShowHourDividers(showHourDividers);
        setLocalPlayerDeviceId(playerAudioDeviceId);
        setLocalDemoPlayerDeviceId(demoPlayerAudioDeviceId);
      }, 0);
      return () => clearTimeout(timeoutId);
    }
    prevModalRef.current = modal;
  }, [
    modal,
    trackItemSizePreset,
    hourDividerInterval,
    showHourDividers,
    playerAudioDeviceId,
    demoPlayerAudioDeviceId,
  ]);

  if (modal !== 'settings') {
    return null;
  }

  const handleSave = async () => {
    setTrackItemSizePreset(localTrackItemSizePreset);
    setHourDividerInterval(localHourDividerInterval);
    setShowHourDividers(localShowHourDividers);

    // Сохраняем выбранные устройства
    setPlayerAudioDeviceId(localPlayerDeviceId);
    setDemoPlayerAudioDeviceId(localDemoPlayerDeviceId);

    // Применяем выбранные устройства к плеерам
    // Важно: вызываем setAudioDevice всегда, даже если deviceId === null,
    // чтобы применить устройство по умолчанию при переключении с конкретного устройства
    try {
      const playerStore = usePlayerAudioStore.getState();
      const demoPlayerStore = useDemoPlayerStore.getState();

      // Применяем устройства параллельно для лучшей производительности
      await Promise.all([
        playerStore.setAudioDevice(localPlayerDeviceId),
        demoPlayerStore.setAudioDevice(localDemoPlayerDeviceId),
      ]);
    } catch (error) {
      console.error('Failed to apply audio devices', error);
      addNotification({
        type: 'warning',
        message: 'Не удалось применить выбранные аудиоустройства',
      });
    }

    addNotification({ type: 'success', message: 'Настройки сохранены' });
    closeModal();
  };

  const handleCancel = () => {
    setLocalTrackItemSizePreset(trackItemSizePreset);
    setLocalHourDividerInterval(hourDividerInterval);
    setLocalShowHourDividers(showHourDividers);
    setLocalPlayerDeviceId(playerAudioDeviceId);
    setLocalDemoPlayerDeviceId(demoPlayerAudioDeviceId);
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
              >
                <option value={getDefaultDeviceId()}>По умолчанию</option>
                {audioDevices.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label}
                  </option>
                ))}
              </select>
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
              >
                <option value={getDefaultDeviceId()}>По умолчанию</option>
                {audioDevices.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label}
                  </option>
                ))}
              </select>
            )}
          </div>
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
