import { createWithEqualityFn } from 'zustand/traditional';

import { Track } from '@core/types/track';
import { WorkspaceId } from '@core/types/workspace';

import { ipcService } from '../services/ipcService';
import { setAudioSinkId, getDefaultDeviceId } from '../utils/audioDevices';
import { logger } from '../utils/logger';

import { usePlayerAudioStore } from './playerAudioStore';
import { useSettingsStore } from './settingsStore';
import { useUIStore } from './uiStore';

export type PlayerStatus = 'idle' | 'playing' | 'paused' | 'ended';

interface DemoPlayerState {
  currentTrack: Track | null;
  sourceWorkspaceId: WorkspaceId | null;
  status: PlayerStatus;
  position: number;
  duration: number;
  volume: number;
  error: string | null;
  isDisabled: boolean;

  loadTrack: (track: Track, sourceWorkspaceId: WorkspaceId) => Promise<void>;
  play: () => Promise<void>;
  pause: () => void;
  seek: (positionSeconds: number) => void;
  setVolume: (value: number) => void;
  clear: () => void;
  setDisabled: (disabled: boolean) => void;
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
  DemoPlayerState,
  | 'loadTrack'
  | 'play'
  | 'pause'
  | 'seek'
  | 'setVolume'
  | 'clear'
  | 'setDuration'
  | 'setPosition'
  | 'handleEnded'
  | 'handleError'
  | 'setDisabled'
  | 'setAudioDevice'
> = {
  currentTrack: null,
  sourceWorkspaceId: null,
  status: 'idle',
  position: 0,
  duration: 0,
  volume: 0.8,
  error: null,
  isDisabled: false,
};

export const useDemoPlayerStore = createWithEqualityFn<DemoPlayerState>((set, get) => {
  let audioElement: HTMLAudioElement | null = null;
  let currentObjectUrl: string | null = null;
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

  const cleanupAudioElement = () => {
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
      const deviceId = useSettingsStore.getState().demoPlayerAudioDeviceId;
      setAudioSinkId(audioElement, deviceId).catch((error) => {
        logger.error('Failed to set audio device on element creation', error);
        // Проверяем, является ли это ошибкой "устройство не найдено"
        const isDeviceNotFound =
          error instanceof DOMException &&
          (error.name === 'NotFoundError' || error.message.includes('not found'));

        if (isDeviceNotFound && deviceId !== null) {
          // Устройство не найдено - обновляем настройки
          useSettingsStore.getState().setDemoPlayerAudioDeviceId(null);
          useUIStore.getState().addNotification({
            type: 'warning',
            message:
              'Выбранное аудиоустройство для демо-плеера недоступно. Используется устройство по умолчанию.',
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

  const syncWithPlayer = (deviceId: string | null) => {
    const playerDeviceId = useSettingsStore.getState().playerAudioDeviceId;
    const playerState = usePlayerAudioStore.getState();

    // Проверяем, совпадают ли устройства
    const devicesMatch =
      deviceId !== null && playerDeviceId !== null && deviceId === playerDeviceId;

    if (devicesMatch) {
      // Если устройства совпадают и плеер играет, останавливаем и блокируем демо-плеер
      if (playerState.status === 'playing') {
        get().pause();
        set({ isDisabled: true });
      } else {
        // Если плеер не играет, просто блокируем
        set({ isDisabled: true });
      }
    } else {
      // Если устройства не совпадают, снимаем блокировку
      set({ isDisabled: false });
    }
  };

  return {
    ...INITIAL_STATE,

    loadTrack: async (track, sourceWorkspaceId) => {
      try {
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
        const deviceId = useSettingsStore.getState().demoPlayerAudioDeviceId;
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
            useSettingsStore.getState().setDemoPlayerAudioDeviceId(null);
            useUIStore.getState().addNotification({
              type: 'warning',
              message:
                'Выбранное аудиоустройство для демо-плеера недоступно. Используется устройство по умолчанию.',
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
          sourceWorkspaceId,
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
      const { currentTrack, handleError, isDisabled } = get();
      if (!currentTrack || isDisabled) {
        return;
      }

      try {
        const audio = getAudioElement();
        // Применяем выбранное устройство перед воспроизведением (включая null для устройства по умолчанию)
        const deviceId = useSettingsStore.getState().demoPlayerAudioDeviceId;
        try {
          await setAudioSinkId(audio, deviceId);
          // Синхронизируем с плеером после установки устройства
          syncWithPlayer(deviceId);
        } catch (error) {
          logger.error('Failed to set audio device on play', error);
          // Проверяем, является ли это ошибкой "устройство не найдено"
          const isDeviceNotFound =
            error instanceof DOMException &&
            (error.name === 'NotFoundError' || error.message.includes('not found'));

          if (isDeviceNotFound && deviceId !== null) {
            // Устройство не найдено - обновляем настройки и используем устройство по умолчанию
            useSettingsStore.getState().setDemoPlayerAudioDeviceId(null);
            useUIStore.getState().addNotification({
              type: 'warning',
              message:
                'Выбранное аудиоустройство для демо-плеера недоступно. Используется устройство по умолчанию.',
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

      audioElement.pause();
      set({ status: 'paused' });
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
      cleanupAudioElement();
      revokeCurrentObjectUrl();
      const preservedVolume = get().volume;
      set({ ...INITIAL_STATE, volume: preservedVolume });
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
      const { duration } = get();
      set({
        status: 'ended',
        position: duration || 0,
      });
    },

    handleError: (message, error) => {
      logger.error('Demo player error', error instanceof Error ? error : undefined);
      set({
        status: 'idle',
        error: message,
      });
    },

    setDisabled: (disabled) => {
      set({ isDisabled: disabled });
      if (disabled && get().status === 'playing') {
        get().pause();
      }
    },

    setAudioDevice: async (deviceId) => {
      const audio = audioElement ?? getAudioElement();
      try {
        await setAudioSinkId(audio, deviceId);
        // Синхронизируем с плеером
        syncWithPlayer(deviceId);
      } catch (error) {
        logger.error('Failed to set audio device', error);
        // Проверяем, является ли это ошибкой "устройство не найдено"
        const isDeviceNotFound =
          error instanceof DOMException &&
          (error.name === 'NotFoundError' || error.message.includes('not found'));

        if (isDeviceNotFound) {
          // Устройство не найдено - обновляем настройки и используем устройство по умолчанию
          useSettingsStore.getState().setDemoPlayerAudioDeviceId(null);
          useUIStore.getState().addNotification({
            type: 'warning',
            message:
              'Выбранное аудиоустройство для демо-плеера недоступно. Используется устройство по умолчанию.',
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

// Подписываемся на изменения настроек аудиоустройства для демо-плеера
// Это позволяет автоматически применять изменения настроек, даже если они были изменены извне
let previousDemoDeviceId: string | null = useSettingsStore.getState().demoPlayerAudioDeviceId;
useSettingsStore.subscribe((state) => {
  const currentDeviceId = state.demoPlayerAudioDeviceId;
  // Проверяем, изменилось ли значение, чтобы избежать лишних вызовов
  if (currentDeviceId !== previousDemoDeviceId) {
    previousDemoDeviceId = currentDeviceId;
    // Применяем новое устройство, если audio элемент уже создан
    const store = useDemoPlayerStore.getState();
    // Используем внутренний метод для применения устройства
    if (store.setAudioDevice) {
      store.setAudioDevice(currentDeviceId).catch((error) => {
        logger.error('Failed to apply audio device from settings change', error);
      });
    }
  }
});
