import { isAudioTrack, isEmptyTrack, type ProgramPlayableItem } from '@core/types/project';
import { Track } from '@core/types/track';
import { createWithEqualityFn } from 'zustand/traditional';

import { wireLoudnessPlaybackSync } from '../audio/playback/loudnessPlaybackSync';
import { mainPlaybackEngine } from '../audio/playback/playbackEngines';
import {
  isSilenceProgramPlaybackTrack,
  loadSilenceProgramTrack,
  pauseSilenceProgramPlayback,
  playSilenceProgramPlayback,
  seekSilenceProgramPlayback,
  stopSilenceProgramPlayback,
  wireSilenceProgramPlayback,
} from '../audio/playback/silenceProgramPlayback';
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
  currentTrack: ProgramPlayableItem | null;
  status: PlayerAudioStatus;
  position: number;
  duration: number;
  volume: number;
  error: string | null;
  onTrackEnded?: () => void;

  loadTrack: (track: ProgramPlayableItem, autoPlay?: boolean) => Promise<number>;
  shouldAutoPlayTrack: (trackId: string, generation: number) => boolean;
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

const notifyMissingTrack = (track: ProgramPlayableItem): void => {
  if (isEmptyTrack(track)) {
    return;
  }
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
let trackLoadGeneration = 0;
let pendingAutoPlay: { generation: number; trackId: string } | null = null;

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

    loadTrack: async (track, autoPlay = false) => {
      const generation = ++trackLoadGeneration;
      pendingAutoPlay = autoPlay ? { generation, trackId: track.id } : null;
      if (isDemoLiveMockPlaybackEnabled()) {
        clearPauseTimer();
        loadDemoLiveMockTrack(track as Track);
        if (autoPlay) {
          set({ status: 'loading' });
        }
        return generation;
      }

      if (isEmptyTrack(track)) {
        clearPauseTimer();
        stopSilenceProgramPlayback();
        playbackEngine.stop();
        loadSilenceProgramTrack(track);
        if (generation !== trackLoadGeneration) {
          return generation;
        }
        set({
          currentTrack: track,
          status: pendingAutoPlay?.generation === generation ? 'loading' : 'paused',
          position: 0,
          duration: track.duration,
          error: null,
        });
        return generation;
      }

      if (!isAudioTrack(track)) {
        return generation;
      }

      try {
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
            if (generation !== trackLoadGeneration) {
              return;
            }
            set({
              currentTrack: { ...activeTrack, isMissing: false },
              status: pendingAutoPlay?.generation === generation ? 'loading' : 'paused',
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
        if (generation === trackLoadGeneration && get().currentTrack?.id !== track.id) {
          pendingAutoPlay = null;
        }
      } catch (error) {
        if (generation === trackLoadGeneration) {
          pendingAutoPlay = null;
        }
        throw error;
      }
      return generation;
    },

    shouldAutoPlayTrack: (trackId, generation) =>
      pendingAutoPlay?.trackId === trackId && pendingAutoPlay.generation === generation,

    play: async () => {
      const autoPlayGeneration = pendingAutoPlay?.generation;
      if (isDemoLiveMockPlaybackEnabled()) {
        clearPauseTimer();
        playDemoLiveMockPlayback();
        if (pendingAutoPlay?.generation === autoPlayGeneration) {
          pendingAutoPlay = null;
        }
        return;
      }

      if (isSilenceProgramPlaybackTrack(get().currentTrack)) {
        clearPauseTimer();
        set({ status: 'playing', error: null });
        playSilenceProgramPlayback();
        if (pendingAutoPlay?.generation === autoPlayGeneration) {
          pendingAutoPlay = null;
        }
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
          canPlay: () =>
            autoPlayGeneration === undefined ||
            (trackLoadGeneration === autoPlayGeneration &&
              pendingAutoPlay?.generation === autoPlayGeneration),
        });
      } catch (error) {
        throw error instanceof Error ? error : new Error('Failed to start playback');
      } finally {
        if (pendingAutoPlay?.generation === autoPlayGeneration) {
          pendingAutoPlay = null;
        }
      }
    },

    pause: () => {
      clearPauseTimer();
      const isAutoPlayPending = pendingAutoPlay !== null;
      pendingAutoPlay = null;
      if (isAutoPlayPending && get().status === 'loading') {
        set({ status: 'paused' });
      }
      if (isDemoLiveMockPlaybackEnabled()) {
        pauseDemoLiveMockPlayback();
        return;
      }
      if (isSilenceProgramPlaybackTrack(get().currentTrack)) {
        pauseSilenceProgramPlayback();
        set({ status: 'paused' });
        return;
      }
      playbackEngine.pause();
    },

    stop: () => {
      clearPauseTimer();
      trackLoadGeneration += 1;
      pendingAutoPlay = null;
      if (isDemoLiveMockPlaybackEnabled()) {
        stopDemoLiveMockPlayback();
        set({ status: 'idle', position: 0, error: null });
        return;
      }
      stopSilenceProgramPlayback();
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

      const { currentTrack, duration, status } = get();
      if (!currentTrack) {
        return;
      }

      if (isSilenceProgramPlaybackTrack(currentTrack)) {
        const clamped = seekSilenceProgramPlayback(positionSeconds, duration);
        set({ position: clamped, status: status === 'ended' ? 'paused' : status });
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
      trackLoadGeneration += 1;
      pendingAutoPlay = null;
      if (isDemoLiveMockPlaybackEnabled()) {
        stopDemoLiveMockPlayback();
        const preservedVolume = get().volume;
        set({ ...INITIAL_STATE, volume: preservedVolume });
        return;
      }
      stopSilenceProgramPlayback();
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

wireSilenceProgramPlayback({
  getState: () => {
    const state = usePlayerAudioStore.getState();
    return {
      status: state.status,
      position: state.position,
      duration: state.duration,
      currentTrack: state.currentTrack,
    };
  },
  setPosition: (positionSeconds) => {
    usePlayerAudioStore.getState().setPosition(positionSeconds);
  },
  handleEnded: () => {
    usePlayerAudioStore.getState().handleEnded();
  },
});

wireLoudnessPlaybackSync();

wirePlaybackEngine({
  engine: playbackEngine,
  getStatus: () => usePlayerAudioStore.getState().status,
  setStatus: (status) => {
    if (status === 'paused' && usePlayerAudioStore.getState().status === 'idle') {
      return;
    }
    if (status === 'paused' && pendingAutoPlay?.generation === trackLoadGeneration) {
      return;
    }
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
