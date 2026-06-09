import { createWithEqualityFn } from 'zustand/traditional';

import { Track } from '@core/types/track';
import { WorkspaceId } from '@core/types/workspace';

import { demoPlaybackEngine } from '../audio/playback/playbackEngines';
import { formatMissingTrackMessage } from '../utils/fileErrors';
import { logger } from '../utils/logger';

import { syncDemoWithMainPlayer } from './playbackDeviceConflictSync';
import {
  clampPlaybackValue,
  createApplyDevice,
  createHandleError,
  loadTrackCore,
  playTrackCore,
  PlaybackStoreStatus,
  resolveTrackPrecheck,
  wirePlaybackEngine,
} from './playbackStoreCore';
import { getProjectStore } from './projectStoreFactory';
import { useSettingsStore } from './settingsStore';
import { useUIStore } from './uiStore';

export type PlayerStatus = PlaybackStoreStatus;

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

  setDuration: (durationSeconds: number) => void;
  setPosition: (positionSeconds: number) => void;
  handleEnded: () => void;
  handleError: (message: string, error?: unknown) => void;
}

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

const notifyMissingTrack = (track: Track): void => {
  useUIStore.getState().addNotification({
    type: 'warning',
    message: formatMissingTrackMessage(track.name, track.path),
  });
};

const playbackEngine = demoPlaybackEngine;

export const useDemoPlayerStore = createWithEqualityFn<DemoPlayerState>((set, get) => {
  const applyDevice = createApplyDevice({
    engine: playbackEngine,
    onDeviceNotFound: () => {
      useSettingsStore.getState().setDemoPlayerAudioDeviceId(null);
      useUIStore.getState().addNotification({
        type: 'warning',
        message:
          'Выбранное аудиоустройство для демо-плеера недоступно. Используется устройство по умолчанию.',
      });
    },
  });

  const handleError = createHandleError({
    engine: playbackEngine,
    logLabel: 'Demo player',
    setErrorState: (message) => {
      set({ status: 'error', error: message });
    },
  });

  return {
    ...INITIAL_STATE,

    loadTrack: async (track, sourceWorkspaceId) => {
      const markTrackFound = (trackId: string) => {
        getProjectStore(sourceWorkspaceId)?.getState().markTrackAsMissing?.(trackId, false);
      };
      const markTrackMissing = (trackId: string) => {
        getProjectStore(sourceWorkspaceId)?.getState().markTrackAsMissing?.(trackId, true);
      };

      await loadTrackCore({
        engine: playbackEngine,
        track,
        applyDevice,
        getDeviceId: () => useSettingsStore.getState().demoPlayerAudioDeviceId,
        markTrackFound,
        resolvePrecheck: (activeTrack) =>
          resolveTrackPrecheck({
            track: activeTrack,
            markTrackFound,
            notifyMissingTrack,
            handleError,
          }),
        onSuccess: (activeTrack, duration) => {
          set({
            currentTrack: { ...activeTrack, isMissing: false },
            sourceWorkspaceId,
            status: 'paused',
            position: 0,
            duration,
            error: null,
          });
        },
        onFileNotFound: (activeTrack) => {
          markTrackMissing(activeTrack.id);
          notifyMissingTrack(activeTrack);
        },
      });
    },

    play: async () => {
      try {
        await playTrackCore({
          engine: playbackEngine,
          currentTrack: get().currentTrack,
          applyDevice,
          getDeviceId: () => useSettingsStore.getState().demoPlayerAudioDeviceId,
          syncDevice: syncDemoWithMainPlayer,
          canPlay: () => !get().isDisabled,
        });
      } catch (error) {
        throw error instanceof Error ? error : new Error('Failed to start playback');
      }
    },

    pause: () => {
      playbackEngine.pause();
    },

    seek: (positionSeconds) => {
      const { currentTrack, duration } = get();
      if (!currentTrack) {
        return;
      }

      const snapshot = playbackEngine.getSnapshot();
      const effectiveDuration = duration || snapshot.duration || 0;
      const clamped =
        effectiveDuration > 0
          ? clampPlaybackValue(positionSeconds, 0, effectiveDuration)
          : Math.max(0, positionSeconds);
      playbackEngine.seek(clamped);
      set({ position: clamped, status: get().status === 'ended' ? 'paused' : get().status });
    },

    setVolume: (value) => {
      const safeValue = clampPlaybackValue(value, 0, 1);
      playbackEngine.setVolume(safeValue);
      set({ volume: safeValue });
    },

    clear: () => {
      playbackEngine.stop();
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

    handleError,

    setDisabled: (disabled) => {
      set({ isDisabled: disabled });
      if (disabled && get().status === 'playing') {
        get().pause();
      }
    },

    setAudioDevice: async (deviceId) => {
      await applyDevice(deviceId, 'setAudioDevice');
      syncDemoWithMainPlayer(deviceId);
    },
  };
});

wirePlaybackEngine({
  engine: playbackEngine,
  getStatus: () => useDemoPlayerStore.getState().status,
  setStatus: (status) => {
    useDemoPlayerStore.setState(status === 'playing' ? { status, error: null } : { status });
  },
  setPosition: (position) => {
    useDemoPlayerStore.getState().setPosition(position);
  },
  setDuration: (duration) => {
    useDemoPlayerStore.getState().setDuration(duration);
  },
  handleEnded: () => {
    useDemoPlayerStore.getState().handleEnded();
  },
  handleError: (message, error) => {
    useDemoPlayerStore.getState().handleError(message, error);
  },
  getDeviceId: () => useSettingsStore.getState().demoPlayerAudioDeviceId,
  selectSettingsDeviceId: (state) => state.demoPlayerAudioDeviceId,
  onDeviceNotFound: () => {
    useSettingsStore.getState().setDemoPlayerAudioDeviceId(null);
    useUIStore.getState().addNotification({
      type: 'warning',
      message:
        'Выбранное аудиоустройство для демо-плеера недоступно. Используется устройство по умолчанию.',
    });
  },
  onSettingsDeviceChange: (deviceId) => {
    const store = useDemoPlayerStore.getState();
    if (store.setAudioDevice) {
      store.setAudioDevice(deviceId).catch((error) => {
        logger.error('Failed to apply audio device from settings change', error);
      });
    }
  },
  initLogContext: 'engine init',
  initErrorLogLabel: 'demo player',
});
