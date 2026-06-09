import { Track } from '@core/types/track';

import { applyDefaultPlaybackEffects } from '../audio/playback/applyDefaultPlaybackEffects';
import { applyPlaybackOutputDeviceWithFallback } from '../audio/playback/applyPlaybackOutputDeviceWithFallback';
import { bindPlaybackEngineToStore } from '../audio/playback/bindPlaybackEngineToStore';
import type { StorePlaybackStatus } from '../audio/playback/bindPlaybackEngineToStore';
import { clampPlaybackValue } from '../audio/playback/clampPlaybackValue';
import type { PlaybackEngine } from '../audio/playback/PlaybackEngine';
import { notifyDemoUnavailable } from '../demo/notifyDemoUnavailable';
import { getAppMode } from '../platform/appMode';
import { ipcService } from '../services/ipcService';
import { formatMissingTrackMessage, isFileNotFoundError } from '../utils/fileErrors';
import { logger } from '../utils/logger';

import { useSettingsStore } from './settingsStore';

export type PlaybackStoreStatus = StorePlaybackStatus;

export { clampPlaybackValue };

export interface CreateApplyDeviceOptions {
  readonly engine: PlaybackEngine;
  readonly onDeviceNotFound: () => void;
}

export function createApplyDevice({
  engine,
  onDeviceNotFound,
}: CreateApplyDeviceOptions): (deviceId: string | null, logContext: string) => Promise<void> {
  return async (deviceId, logContext) => {
    await applyPlaybackOutputDeviceWithFallback(engine, {
      deviceId,
      logContext,
      onDeviceNotFound,
    });
  };
}

export interface CreateHandleErrorOptions {
  readonly engine: PlaybackEngine;
  readonly logLabel: string;
  readonly setErrorState: (message: string) => void;
}

export function createHandleError({
  engine,
  logLabel,
  setErrorState,
}: CreateHandleErrorOptions): (message: string, error?: unknown) => void {
  return (message, error) => {
    if (isFileNotFoundError(error)) {
      logger.warn(`${logLabel}: missing file`, error instanceof Error ? error : undefined);
    } else {
      logger.error(`${logLabel} error`, error instanceof Error ? error : undefined);
    }
    setErrorState(message);
    engine.stop();
  };
}

export interface ResolveTrackPrecheckOptions {
  readonly track: Track;
  readonly markTrackFound: (trackId: string) => void;
  readonly notifyMissingTrack: (track: Track) => void;
  readonly handleError: (message: string, error?: unknown) => void;
}

export async function resolveTrackPrecheck(
  options: ResolveTrackPrecheckOptions,
): Promise<Track | null> {
  const { track, markTrackFound, notifyMissingTrack, handleError } = options;

  if (!track.isMissing) {
    return track;
  }

  try {
    await ipcService.statFile(track.path, false);
    markTrackFound(track.id);
    return { ...track, isMissing: false };
  } catch {
    notifyMissingTrack(track);
    const message = formatMissingTrackMessage(track.name, track.path);
    handleError(message, new Error(message));
    return null;
  }
}

export interface LoadTrackCoreOptions {
  readonly engine: PlaybackEngine;
  readonly track: Track;
  readonly applyDevice: (deviceId: string | null, logContext: string) => Promise<void>;
  readonly getDeviceId: () => string | null;
  readonly markTrackFound: (trackId: string) => void;
  readonly onFileNotFound: (track: Track, error: unknown) => void;
  readonly onSuccess: (track: Track, duration: number) => void;
  readonly resolvePrecheck: (track: Track) => Promise<Track | null>;
  readonly onBeforeLoad?: () => void;
}

export async function loadTrackCore(options: LoadTrackCoreOptions): Promise<void> {
  if (getAppMode() === 'demo') {
    notifyDemoUnavailable();
    return;
  }

  const activeTrack = await options.resolvePrecheck(options.track);
  if (!activeTrack) {
    return;
  }

  try {
    options.onBeforeLoad?.();

    await options.engine.load({ kind: 'filePath', path: activeTrack.path });
    await options.applyDevice(options.getDeviceId(), 'track load');
    applyDefaultPlaybackEffects(options.engine);
    options.markTrackFound(activeTrack.id);

    const snapshot = options.engine.getSnapshot();
    options.onSuccess(activeTrack, activeTrack.duration ?? snapshot.duration);
  } catch (error) {
    if (isFileNotFoundError(error)) {
      options.onFileNotFound(activeTrack, error);
      throw error instanceof Error
        ? error
        : new Error(formatMissingTrackMessage(activeTrack.name, activeTrack.path));
    }
    throw error instanceof Error ? error : new Error('Failed to load audio source');
  }
}

export interface PlayTrackCoreOptions {
  readonly engine: PlaybackEngine;
  readonly currentTrack: Track | null;
  readonly applyDevice: (deviceId: string | null, logContext: string) => Promise<void>;
  readonly getDeviceId: () => string | null;
  readonly syncDevice: (deviceId: string | null) => void;
  readonly onBeforePlay?: () => void;
  readonly canPlay?: () => boolean;
}

export async function playTrackCore(options: PlayTrackCoreOptions): Promise<void> {
  if (!options.currentTrack || (options.canPlay && !options.canPlay())) {
    return;
  }

  if (getAppMode() === 'demo') {
    notifyDemoUnavailable();
    return;
  }

  options.onBeforePlay?.();

  const deviceId = options.getDeviceId();
  await options.applyDevice(deviceId, 'play');
  options.syncDevice(deviceId);

  if (options.canPlay && !options.canPlay()) {
    return;
  }

  await options.engine.play();
}

export interface WirePlaybackEngineOptions {
  readonly engine: PlaybackEngine;
  readonly getStatus: () => PlaybackStoreStatus;
  readonly setStatus: (status: PlaybackStoreStatus) => void;
  readonly setPosition: (positionSeconds: number) => void;
  readonly setDuration: (durationSeconds: number) => void;
  readonly handleEnded: () => void;
  readonly handleError: (message: string, error?: unknown) => void;
  readonly getDeviceId: () => string | null;
  readonly selectSettingsDeviceId: (state: {
    playerAudioDeviceId: string | null;
    demoPlayerAudioDeviceId: string | null;
  }) => string | null;
  readonly onDeviceNotFound: () => void;
  readonly onSettingsDeviceChange: (deviceId: string | null) => void;
  readonly initLogContext: string;
  readonly initErrorLogLabel: string;
}

export function wirePlaybackEngine(options: WirePlaybackEngineOptions): void {
  bindPlaybackEngineToStore(options.engine, {
    onStatusChanged: (status) => {
      if (options.getStatus() === 'error' && status === 'idle') {
        return;
      }
      if (options.getStatus() !== status) {
        options.setStatus(status);
      }
    },
    onPositionChanged: (position) => {
      options.setPosition(position);
    },
    onDurationChanged: (duration) => {
      options.setDuration(duration);
    },
    onEnded: () => {
      options.handleEnded();
    },
    onError: (message) => {
      options.handleError(message, new Error(message));
    },
  });

  void applyPlaybackOutputDeviceWithFallback(options.engine, {
    deviceId: options.getDeviceId(),
    logContext: options.initLogContext,
    onDeviceNotFound: options.onDeviceNotFound,
  }).catch((error) => {
    logger.error(`Failed to set audio device on ${options.initErrorLogLabel} engine init`, error);
  });

  let previousDeviceId: string | null = options.getDeviceId();
  useSettingsStore.subscribe((state) => {
    const currentDeviceId = options.selectSettingsDeviceId(state);

    if (currentDeviceId !== previousDeviceId) {
      previousDeviceId = currentDeviceId;
      options.onSettingsDeviceChange(currentDeviceId);
    }
  });
}
