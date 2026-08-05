import { createWithEqualityFn } from 'zustand/traditional';

import { Track } from '@core/types/track';

import { wireLoudnessPlaybackSync } from '../audio/playback/loudnessPlaybackSync';
import { mainPlaybackEngine } from '../audio/playback/playbackEngines';
import {
  isDemoLiveMockPlaybackEnabled,
  loadDemoLiveMockTrack,
  pauseDemoLiveMockPlayback,
  playDemoLiveMockPlayback,
  seekDemoLiveMockPlayback,
  stopDemoLiveMockPlayback,
} from '../demo/demoLiveMockPlayback';
import { formatMissingTrackMessage } from '../utils/fileErrors';
import { logger } from '../utils/logger';

import { syncMainWithDemoPlayer } from './playbackDeviceConflictSync';
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
import { useProjectStore } from './projectStore';
import { useSettingsStore } from './settingsStore';
import { useUIStore } from './uiStore';

export type PlayerAudioStatus = PlaybackStoreStatus;

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

  setDuration: (durationSeconds: number) => void;
  setPosition: (positionSeconds: number) => void;
  handleEnded: () => void;
  handleError: (message: string, error?: unknown) => void;
}

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

const notifyMissingTrack = (track: Track): void => {
  useUIStore.getState().addNotification({
    type: 'warning',
    message: formatMissingTrackMessage(track.name, track.path),
  });
};

const markTrackFound = (trackId: string): void => {
  useProjectStore.getState().markTrackAsMissing?.(trackId, false);
};

const markTrackMissing = (trackId: string): void => {
  useProjectStore.getState().markTrackAsMissing?.(trackId, true);
};

const playbackEngine = mainPlaybackEngine;

export const usePlayerAudioStore = createWithEqualityFn<PlayerAudioState>((set, get) => {
  let pauseTimerId: NodeJS.Timeout | null = null;

  const clearPauseTimer = () => {
    if (pauseTimerId !== null) {
      clearTimeout(pauseTimerId);
      pauseTimerId = null;
    }
  };

  const applyDevice = createApplyDevice({
    engine: playbackEngine,
    onDeviceNotFound: () => {
      useSettingsStore.getState().setPlayerAudioDeviceId(null);
      useUIStore.getState().addNotification({
        type: 'warning',
        message: 'Выбранное аудиоустройство недоступно. Используется устройство по умолчанию.',
      });
    },
  });

  const handleError = createHandleError({
    engine: playbackEngine,
    logLabel: 'Player audio',
    setErrorState: (message) => {
      set({ status: 'error', error: message });
    },
  });

  return {
    ...INITIAL_STATE,

    loadTrack: async (track) => {
      if (isDemoLiveMockPlaybackEnabled()) {
        clearPauseTimer();
        loadDemoLiveMockTrack(track);
        return;
      }

      await loadTrackCore({
        engine: playbackEngine,
        track,
        applyDevice,
        getDeviceId: () => useSettingsStore.getState().playerAudioDeviceId,
        markTrackFound,
        onBeforeLoad: clearPauseTimer,
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
      if (isDemoLiveMockPlaybackEnabled()) {
        clearPauseTimer();
        playDemoLiveMockPlayback();
        return;
      }

      try {
        await playTrackCore({
          engine: playbackEngine,
          currentTrack: get().currentTrack,
          applyDevice,
          getDeviceId: () => useSettingsStore.getState().playerAudioDeviceId,
          syncDevice: syncMainWithDemoPlayer,
          onBeforePlay: clearPauseTimer,
        });
      } catch (error) {
        throw error instanceof Error ? error : new Error('Failed to start playback');
      }
    },

    pause: () => {
      clearPauseTimer();
      if (isDemoLiveMockPlaybackEnabled()) {
        pauseDemoLiveMockPlayback();
        return;
      }
      playbackEngine.pause();
    },

    stop: () => {
      clearPauseTimer();
      if (isDemoLiveMockPlaybackEnabled()) {
        stopDemoLiveMockPlayback();
        set({ status: 'idle', position: 0, error: null });
        return;
      }
      playbackEngine.stop();
      set({ status: 'idle', position: 0, error: null });
    },

    next: () => {
      get().stop();
    },

    seek: (positionSeconds) => {
      if (isDemoLiveMockPlaybackEnabled()) {
        seekDemoLiveMockPlayback(positionSeconds);
        return;
      }

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
      clearPauseTimer();
      if (isDemoLiveMockPlaybackEnabled()) {
        stopDemoLiveMockPlayback();
        const preservedVolume = get().volume;
        set({ ...INITIAL_STATE, volume: preservedVolume });
        return;
      }
      playbackEngine.stop();
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
      if (onTrackEnded) {
        onTrackEnded();
      }
    },

    setOnTrackEnded: (callback) => {
      set({ onTrackEnded: callback });
    },

    handleError,

    setAudioDevice: async (deviceId) => {
      await applyDevice(deviceId, 'setAudioDevice');
      syncMainWithDemoPlayer(deviceId);
    },
  };
});

wireLoudnessPlaybackSync();

wirePlaybackEngine({
  engine: playbackEngine,
  getStatus: () => usePlayerAudioStore.getState().status,
  setStatus: (status) => {
    usePlayerAudioStore.setState(status === 'playing' ? { status, error: null } : { status });
  },
  setPosition: (position) => {
    usePlayerAudioStore.getState().setPosition(position);
  },
  setDuration: (duration) => {
    usePlayerAudioStore.getState().setDuration(duration);
  },
  handleEnded: () => {
    usePlayerAudioStore.getState().handleEnded();
  },
  handleError: (message, error) => {
    usePlayerAudioStore.getState().handleError(message, error);
  },
  getDeviceId: () => useSettingsStore.getState().playerAudioDeviceId,
  selectSettingsDeviceId: (state) => state.playerAudioDeviceId,
  onDeviceNotFound: () => {
    useSettingsStore.getState().setPlayerAudioDeviceId(null);
    useUIStore.getState().addNotification({
      type: 'warning',
      message: 'Выбранное аудиоустройство недоступно. Используется устройство по умолчанию.',
    });
  },
  onSettingsDeviceChange: (deviceId) => {
    const store = usePlayerAudioStore.getState();
    if (store.setAudioDevice) {
      store.setAudioDevice(deviceId).catch((error) => {
        logger.error('Failed to apply audio device from settings change', error);
      });
    }
  },
  initLogContext: 'engine init',
  initErrorLogLabel: 'player',
});
