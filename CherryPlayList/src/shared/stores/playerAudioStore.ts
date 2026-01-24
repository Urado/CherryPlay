import { createWithEqualityFn } from 'zustand/traditional';

import { Track } from '@core/types/track';

import { ipcService } from '../services/ipcService';
import { setAudioSinkId, getDefaultDeviceId } from '../utils/audioDevices';
import { logger } from '../utils/logger';

import { useDemoPlayerStore } from './demoPlayerStore';
import { useSettingsStore } from './settingsStore';
import { useUIStore } from './uiStore';

export type PlayerAudioStatus = 'idle' | 'playing' | 'paused' | 'ended';

interface PlayerAudioState {
  currentTrack: Track | null;
  status: PlayerAudioStatus;
  position: number;
  duration: number;
  volume: number;
  error: string | null;
  onTrackEnded?: () => void;

  loadTrack: (track: Track) => Promise<void>;
  play: () => Promise<void>;
  pause: () => void;
  stop: () => void;
  next: () => void;
  seek: (positionSeconds: number) => void;
  setVolume: (value: number) => void;
  setOnTrackEnded: (callback: (() => void) | undefined) => void;
  clear: () => void;
  setPauseTimer: (callback: () => void, delayMs: number) => void;
  clearPauseTimer: () => void;
  setAudioDevice: (deviceId: string | null) => Promise<void>;

  // Internal actions triggered by audio events
  setDuration: (durationSeconds: number) => void;
  setPosition: (positionSeconds: number) => void;
  handleEnded: () => void;
  handleError: (message: string, error?: unknown) => void;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
  const binaryString = atob(base64);
  const length = binaryString.length;
  const bytes = new Uint8Array(length);

  for (let i = 0; i < length; i += 1) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return bytes.buffer;
};

const INITIAL_STATE: Omit<
  PlayerAudioState,
  | 'loadTrack'
  | 'play'
  | 'pause'
  | 'stop'
  | 'next'
  | 'seek'
  | 'setVolume'
  | 'setOnTrackEnded'
  | 'clear'
  | 'setDuration'
  | 'setPosition'
  | 'handleEnded'
  | 'handleError'
  | 'setPauseTimer'
  | 'clearPauseTimer'
  | 'setAudioDevice'
> = {
  currentTrack: null,
  status: 'idle',
  position: 0,
  duration: 0,
  volume: 0.8,
  error: null,
  onTrackEnded: undefined,
};

export const usePlayerAudioStore = createWithEqualityFn<PlayerAudioState>((set, get) => {
  let audioElement: HTMLAudioElement | null = null;
  let currentObjectUrl: string | null = null;
  let pauseTimerId: NodeJS.Timeout | null = null;
  // Store event handlers for cleanup
  let eventHandlers: {
    ended?: () => void;
    timeupdate?: () => void;
    loadedmetadata?: () => void;
    error?: () => void;
    pause?: () => void;
    play?: () => void;
  } = {};

  const revokeCurrentObjectUrl = () => {
    if (currentObjectUrl) {
      URL.revokeObjectURL(currentObjectUrl);
      currentObjectUrl = null;
    }
  };

  const clearPauseTimer = () => {
    if (pauseTimerId !== null) {
      clearTimeout(pauseTimerId);
      pauseTimerId = null;
    }
  };

  const cleanupAudioElement = () => {
    clearPauseTimer();
    if (audioElement) {
      // Remove all event listeners
      if (eventHandlers.ended) {
        audioElement.removeEventListener('ended', eventHandlers.ended);
      }
      if (eventHandlers.timeupdate) {
        audioElement.removeEventListener('timeupdate', eventHandlers.timeupdate);
      }
      if (eventHandlers.loadedmetadata) {
        audioElement.removeEventListener('loadedmetadata', eventHandlers.loadedmetadata);
      }
      if (eventHandlers.error) {
        audioElement.removeEventListener('error', eventHandlers.error);
      }
      if (eventHandlers.pause) {
        audioElement.removeEventListener('pause', eventHandlers.pause);
      }
      if (eventHandlers.play) {
        audioElement.removeEventListener('play', eventHandlers.play);
      }
      // Clear handlers
      eventHandlers = {};
      // Pause and clear src
      audioElement.pause();
      audioElement.src = '';
      audioElement.currentTime = 0;
      audioElement = null;
    }
  };

  const getAudioElement = (): HTMLAudioElement => {
    if (!audioElement) {
      audioElement = new Audio();
      audioElement.preload = 'auto';
      audioElement.crossOrigin = 'anonymous';
      audioElement.volume = 0.8;

      // Create and store event handlers
      eventHandlers.ended = () => {
        get().handleEnded();
      };
      eventHandlers.timeupdate = () => {
        get().setPosition(audioElement?.currentTime ?? 0);
      };
      eventHandlers.loadedmetadata = () => {
        const duration = audioElement?.duration ?? 0;
        if (Number.isFinite(duration)) {
          get().setDuration(duration);
        }
      };
      eventHandlers.error = () => {
        const mediaError = audioElement?.error;
        const code = mediaError?.code;
        const errorMessages: Record<number, string> = {
          1: 'Воспроизведение прервано системой',
          2: 'Ошибка сети при воспроизведении',
          3: 'Невозможно декодировать аудио',
          4: 'Файл не найден или формат не поддерживается',
        };
        const message =
          (code && errorMessages[code]) ||
          'Не удалось воспроизвести трек. Проверьте файл и попробуйте снова.';
        get().handleError(message, mediaError ?? undefined);
      };
      eventHandlers.pause = () => {
        // Синхронизируем состояние при системной паузе
        const currentStatus = get().status;
        if (currentStatus === 'playing') {
          clearPauseTimer();
          set({ status: 'paused' });
        }
      };
      eventHandlers.play = () => {
        // Синхронизируем состояние при системном возобновлении
        const currentStatus = get().status;
        if (currentStatus === 'paused' || currentStatus === 'idle') {
          set({ status: 'playing', error: null });
        }
      };

      // Add event listeners
      audioElement.addEventListener('ended', eventHandlers.ended);
      audioElement.addEventListener('timeupdate', eventHandlers.timeupdate);
      audioElement.addEventListener('loadedmetadata', eventHandlers.loadedmetadata);
      audioElement.addEventListener('error', eventHandlers.error);
      audioElement.addEventListener('pause', eventHandlers.pause);
      audioElement.addEventListener('play', eventHandlers.play);

      // Применяем выбранное устройство из настроек (включая null для устройства по умолчанию)
      const deviceId = useSettingsStore.getState().playerAudioDeviceId;
      setAudioSinkId(audioElement, deviceId).catch((error) => {
        logger.error('Failed to set audio device on element creation', error);
        // Проверяем, является ли это ошибкой "устройство не найдено"
        const isDeviceNotFound =
          error instanceof DOMException &&
          (error.name === 'NotFoundError' || error.message.includes('not found'));

        if (isDeviceNotFound && deviceId !== null) {
          // Устройство не найдено - обновляем настройки
          useSettingsStore.getState().setPlayerAudioDeviceId(null);
          useUIStore.getState().addNotification({
            type: 'warning',
            message: 'Выбранное аудиоустройство недоступно. Используется устройство по умолчанию.',
          });
          // Пробуем установить устройство по умолчанию
          if (audioElement) {
            setAudioSinkId(audioElement, getDefaultDeviceId()).catch((fallbackError) => {
              logger.error('Failed to set default audio device on element creation', fallbackError);
            });
          }
        }
      });
    }

    return audioElement;
  };

  const syncWithDemoPlayer = (deviceId: string | null) => {
    const demoPlayerDeviceId = useSettingsStore.getState().demoPlayerAudioDeviceId;
    const demoPlayerState = useDemoPlayerStore.getState();

    // Проверяем, совпадают ли устройства
    const devicesMatch =
      deviceId !== null && demoPlayerDeviceId !== null && deviceId === demoPlayerDeviceId;

    if (devicesMatch) {
      // Если устройства совпадают, останавливаем и блокируем демо-плеер
      if (demoPlayerState.status === 'playing') {
        demoPlayerState.pause();
      }
      if (demoPlayerState.setDisabled) {
        demoPlayerState.setDisabled(true);
      }
    } else {
      // Если устройства не совпадают, снимаем блокировку демо-плеера
      if (demoPlayerState.setDisabled) {
        demoPlayerState.setDisabled(false);
      }
    }
  };

  return {
    ...INITIAL_STATE,

    loadTrack: async (track) => {
      try {
        // Очищаем таймер паузы при загрузке нового трека
        clearPauseTimer();
        const audio = getAudioElement();
        audio.pause();

        const { buffer, mimeType } = await ipcService.getAudioFileSource(track.path, false);
        const arrayBuffer = base64ToArrayBuffer(buffer);
        const blob = new Blob([arrayBuffer], { type: mimeType });

        revokeCurrentObjectUrl();
        const objectUrl = URL.createObjectURL(blob);
        currentObjectUrl = objectUrl;

        audio.src = objectUrl;
        audio.currentTime = 0;
        audio.volume = get().volume;

        // Применяем выбранное устройство (включая null для устройства по умолчанию)
        const deviceId = useSettingsStore.getState().playerAudioDeviceId;
        try {
          await setAudioSinkId(audio, deviceId);
        } catch (error) {
          logger.error('Failed to set audio device on track load', error);
          // Проверяем, является ли это ошибкой "устройство не найдено"
          const isDeviceNotFound =
            error instanceof DOMException &&
            (error.name === 'NotFoundError' || error.message.includes('not found'));

          if (isDeviceNotFound && deviceId !== null) {
            // Устройство не найдено - обновляем настройки и используем устройство по умолчанию
            useSettingsStore.getState().setPlayerAudioDeviceId(null);
            useUIStore.getState().addNotification({
              type: 'warning',
              message:
                'Выбранное аудиоустройство недоступно. Используется устройство по умолчанию.',
            });
            // Пробуем установить устройство по умолчанию
            try {
              await setAudioSinkId(audio, getDefaultDeviceId());
            } catch (fallbackError) {
              logger.error('Failed to set default audio device', fallbackError);
            }
          }
        }

        set({
          currentTrack: track,
          status: 'paused',
          position: 0,
          duration: track.duration ?? 0,
          error: null,
        });
      } catch (error) {
        get().handleError('Не удалось загрузить файл для воспроизведения', error);
        throw error instanceof Error ? error : new Error('Failed to load audio source');
      }
    },

    play: async () => {
      const { currentTrack, handleError } = get();
      if (!currentTrack) {
        return;
      }

      // Очищаем таймер паузы при ручном запуске воспроизведения
      clearPauseTimer();

      try {
        const audio = getAudioElement();
        // Применяем выбранное устройство перед воспроизведением (включая null для устройства по умолчанию)
        const deviceId = useSettingsStore.getState().playerAudioDeviceId;
        try {
          await setAudioSinkId(audio, deviceId);
          // Синхронизируем с демо-плеером после установки устройства
          syncWithDemoPlayer(deviceId);
        } catch (error) {
          logger.error('Failed to set audio device on play', error);
          // Проверяем, является ли это ошибкой "устройство не найдено"
          const isDeviceNotFound =
            error instanceof DOMException &&
            (error.name === 'NotFoundError' || error.message.includes('not found'));

          if (isDeviceNotFound && deviceId !== null) {
            // Устройство не найдено - обновляем настройки и используем устройство по умолчанию
            useSettingsStore.getState().setPlayerAudioDeviceId(null);
            useUIStore.getState().addNotification({
              type: 'warning',
              message:
                'Выбранное аудиоустройство недоступно. Используется устройство по умолчанию.',
            });
            // Пробуем установить устройство по умолчанию
            try {
              await setAudioSinkId(audio, getDefaultDeviceId());
            } catch (fallbackError) {
              logger.error('Failed to set default audio device', fallbackError);
            }
          }
        }
        await audio.play();
        set({ status: 'playing', error: null });
      } catch (error) {
        handleError('Не удалось воспроизвести трек', error);
        throw error instanceof Error ? error : new Error('Failed to start playback');
      }
    },

    pause: () => {
      if (!audioElement) {
        return;
      }

      clearPauseTimer();
      audioElement.pause();
      set({ status: 'paused' });
    },

    stop: () => {
      if (!audioElement) {
        return;
      }

      // Очищаем таймер паузы при остановке
      clearPauseTimer();
      audioElement.pause();
      audioElement.currentTime = 0;
      set({ status: 'idle', position: 0 });
    },

    next: () => {
      // Next будет обрабатываться на уровне PlayerView
      // Здесь просто останавливаем текущее воспроизведение
      get().stop();
    },

    seek: (positionSeconds) => {
      const { currentTrack, duration } = get();
      if (!currentTrack) {
        return;
      }

      const audio = audioElement ?? getAudioElement();
      const effectiveDuration = duration || audio.duration || 0;
      const clamped = clamp(positionSeconds, 0, effectiveDuration || positionSeconds);
      audio.currentTime = clamped;
      set({ position: clamped });

      if (get().status === 'ended') {
        set({ status: 'paused' });
      }
    },

    setVolume: (value) => {
      const audio = getAudioElement();
      const safeValue = clamp(value, 0, 1);
      audio.volume = safeValue;
      set({ volume: safeValue });
    },

    clear: () => {
      // Очищаем таймер паузы при очистке
      clearPauseTimer();
      cleanupAudioElement();
      revokeCurrentObjectUrl();
      const preservedVolume = get().volume;
      set({ ...INITIAL_STATE, volume: preservedVolume });
    },

    setPauseTimer: (callback, delayMs) => {
      clearPauseTimer();
      pauseTimerId = setTimeout(() => {
        pauseTimerId = null;
        callback();
      }, delayMs);
    },

    clearPauseTimer: () => {
      clearPauseTimer();
    },

    setDuration: (durationSeconds) => {
      if (!Number.isFinite(durationSeconds)) {
        return;
      }
      set({ duration: durationSeconds });
    },

    setPosition: (positionSeconds) => {
      if (!Number.isFinite(positionSeconds)) {
        return;
      }
      set({ position: positionSeconds });
    },

    handleEnded: () => {
      const { duration, onTrackEnded } = get();
      set({
        status: 'ended',
        position: duration || 0,
      });
      // Вызываем callback для обработки окончания трека
      if (onTrackEnded) {
        onTrackEnded();
      }
    },

    setOnTrackEnded: (callback) => {
      set({ onTrackEnded: callback });
    },

    handleError: (message, error) => {
      logger.error('Player audio error', error instanceof Error ? error : undefined);
      set({
        status: 'idle',
        error: message,
      });
    },

    setAudioDevice: async (deviceId) => {
      const audio = audioElement ?? getAudioElement();
      try {
        await setAudioSinkId(audio, deviceId);
        // Синхронизируем с демо-плеером
        syncWithDemoPlayer(deviceId);
      } catch (error) {
        logger.error('Failed to set audio device', error);
        // Проверяем, является ли это ошибкой "устройство не найдено"
        const isDeviceNotFound =
          error instanceof DOMException &&
          (error.name === 'NotFoundError' || error.message.includes('not found'));

        if (isDeviceNotFound) {
          // Устройство не найдено - обновляем настройки и используем устройство по умолчанию
          useSettingsStore.getState().setPlayerAudioDeviceId(null);
          useUIStore.getState().addNotification({
            type: 'warning',
            message: 'Выбранное аудиоустройство недоступно. Используется устройство по умолчанию.',
          });
          // Пробуем установить устройство по умолчанию
          try {
            await setAudioSinkId(audio, getDefaultDeviceId());
          } catch (fallbackError) {
            logger.error('Failed to set default audio device', fallbackError);
            throw error;
          }
        } else {
          // Для других ошибок пробрасываем исходную ошибку
          throw error;
        }
      }
    },
  };
});

// Подписываемся на изменения настроек аудиоустройства для плеера
// Это позволяет автоматически применять изменения настроек, даже если они были изменены извне
let previousPlayerDeviceId: string | null = useSettingsStore.getState().playerAudioDeviceId;
useSettingsStore.subscribe((state) => {
  const currentDeviceId = state.playerAudioDeviceId;
  // Проверяем, изменилось ли значение, чтобы избежать лишних вызовов
  if (currentDeviceId !== previousPlayerDeviceId) {
    previousPlayerDeviceId = currentDeviceId;
    // Применяем новое устройство, если audio элемент уже создан
    const store = usePlayerAudioStore.getState();
    // Используем внутренний метод для применения устройства
    if (store.setAudioDevice) {
      store.setAudioDevice(currentDeviceId).catch((error) => {
        logger.error('Failed to apply audio device from settings change', error);
      });
    }
  }
});
