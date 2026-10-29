import { isProjectTrack } from '@core/types/project';
import { LOUDNESS_ALGORITHM_VERSION, type Track, type TrackLoudness } from '@core/types/track';

import { resolveLinearGain } from '../audio/loudnessGain';
import { createDefaultPlatformAudioAdapter } from '../audio/playback/createDefaultPlatformAudioAdapter';
import { TRACK_GAIN_LINEAR_MAX, TRACK_GAIN_LINEAR_MIN } from '../audio/playback/effects';
import type { LoudnessAnalyzeResult, LoudnessSettings } from '../contracts/loudness';
import { getPlatformCapabilities } from '../platform/platformCapabilities';
import { useProjectStore } from '../stores/projectStore';
import { useSettingsStore } from '../stores/settingsStore';

import { ipcService } from './ipcService';

export { TRACK_GAIN_LINEAR_MIN, TRACK_GAIN_LINEAR_MAX };

export type LoudnessCancelToken = {
  cancelled: boolean;
};

export type LoudnessScanProgress = {
  completed: number;
  total: number;
  track: Track;
};

export type NeedsScanOptions = {
  currentMtimeMs?: number;
};

export type NeedsScanContext = {
  inFlightTrackIds?: ReadonlySet<string>;
};

export const normalizeLoadedLoudness = (loudness: TrackLoudness): TrackLoudness | undefined => {
  if (loudness.status === 'pending') {
    return {
      status: 'pending',
      manualGainDb: loudness.manualGainDb,
      manualCompressionStrength: loudness.manualCompressionStrength,
    };
  }
  return loudness;
};

export const needsScan = (
  track: Track,
  settings: Pick<LoudnessSettings, 'loudnessNormalizationEnabled'>,
  options?: NeedsScanOptions,
  context?: NeedsScanContext,
): boolean => {
  if (!settings.loudnessNormalizationEnabled) {
    return false;
  }

  const loudness = track.loudness;
  if (!loudness) {
    return true;
  }

  if (loudness.status === 'pending') {
    return !context?.inFlightTrackIds?.has(track.id);
  }

  if (loudness.status !== 'ok') {
    return true;
  }

  if (loudness.algorithmVersion !== LOUDNESS_ALGORITHM_VERSION) {
    return true;
  }

  if (options?.currentMtimeMs !== undefined) {
    if (loudness.fileMtime === undefined) {
      return true;
    }
    return loudness.fileMtime !== options.currentMtimeMs;
  }

  return false;
};

const mapAnalyzeResultToTrackLoudness = (
  result: LoudnessAnalyzeResult,
  fileMtime: number,
): TrackLoudness => {
  if (result.status === 'error') {
    return {
      status: 'error',
      errorMessage: result.errorMessage,
      fileMtime,
      algorithmVersion: LOUDNESS_ALGORITHM_VERSION,
    };
  }

  return {
    status: 'ok',
    integratedLufs: result.integratedLufs,
    lraLowLufs: result.lraLowLufs,
    lraLu: result.lraLu,
    truePeakDb: result.truePeakDb,
    trackGainDb: result.trackGainDb,
    fileMtime: result.fileMtime ?? fileMtime,
    algorithmVersion: LOUDNESS_ALGORITHM_VERSION,
  };
};

export type LoudnessServiceDeps = {
  getSettings: () => LoudnessSettings;
  getScopeKey?: () => string;
  updateTrackLoudness: (trackId: string, loudness: TrackLoudness) => void;
  getTrackLoudness?: (trackId: string) => TrackLoudness | undefined;
  analyzeLoudness: (
    path: string,
    targetLufs: number,
    requestId?: string,
  ) => Promise<LoudnessAnalyzeResult>;
  cancelLoudnessScan?: (requestId: string) => Promise<boolean>;
  statAudioFile: (path: string) => Promise<{ mtimeMs: number; size: number }>;
  canAnalyze: () => boolean;
};

export type ScanTrackOptions = {
  mtimeMs?: number;
  cancelToken?: LoudnessCancelToken;
  consumer?: 'sessionLookahead' | 'automatic';
};

type ScanEntry = {
  promise: Promise<TrackLoudness>;
  requestId: string | null;
};

type ScanOrchestrationState = {
  inFlightTrackIds: Set<string>;
  inFlightScanPromises: Map<string, Promise<TrackLoudness>>;
  pendingPreviousLoudness: Map<string, TrackLoudness | undefined>;
  scheduledTrackIds: Set<string>;
  scanChain: Promise<void>;
};

const createScanOrchestration = (): ScanOrchestrationState => {
  return {
    inFlightTrackIds: new Set(),
    inFlightScanPromises: new Map(),
    pendingPreviousLoudness: new Map(),
    scheduledTrackIds: new Set(),
    scanChain: Promise.resolve(),
  };
};

export const createLoudnessService = (deps: LoudnessServiceDeps) => {
  const scanState = createScanOrchestration();
  const scanEntries = new Map<string, ScanEntry>();
  let requestSequence = 0;
  let scanGeneration = 0;
  let activeScope = deps.getScopeKey?.();

  const refreshScope = (): number => {
    const nextScope = deps.getScopeKey?.();
    if (nextScope !== activeScope) {
      scanGeneration += 1;
      scanEntries.forEach((entry) => {
        if (entry.requestId) {
          void deps.cancelLoudnessScan?.(entry.requestId).catch(() => undefined);
        }
      });
      scanEntries.clear();
      scanState.inFlightTrackIds.clear();
      scanState.inFlightScanPromises.clear();
      scanState.pendingPreviousLoudness.clear();
      scanState.scheduledTrackIds.clear();
      scanState.scanChain = Promise.resolve();
      activeScope = nextScope;
    }
    return scanGeneration;
  };

  const needsScanContext = (): NeedsScanContext => ({
    inFlightTrackIds: scanState.inFlightTrackIds,
  });

  const setPending = (track: Track): void => {
    scanState.pendingPreviousLoudness.set(track.id, track.loudness);
    deps.updateTrackLoudness(track.id, {
      ...(track.loudness ?? {}),
      status: 'pending',
    });
  };

  const restoreCancelledPending = (trackIds: Iterable<string>): void => {
    for (const trackId of trackIds) {
      const previous = scanState.pendingPreviousLoudness.get(trackId);
      if (previous !== undefined) {
        deps.updateTrackLoudness(trackId, previous);
      } else {
        deps.updateTrackLoudness(trackId, {
          status: 'error',
          errorMessage: 'Scan cancelled',
          algorithmVersion: LOUDNESS_ALGORITHM_VERSION,
        });
      }
      scanState.pendingPreviousLoudness.delete(trackId);
      scanState.inFlightTrackIds.delete(trackId);
    }
  };

  const buildPendingLoudness = (track: Track): TrackLoudness => {
    if (track.loudness?.status === 'pending') {
      return track.loudness;
    }

    const previous = scanState.pendingPreviousLoudness.get(track.id);
    return {
      ...(previous ?? track.loudness),
      status: 'pending',
    };
  };

  const mergeManualSettings = (trackId: string, loudness: TrackLoudness): TrackLoudness => {
    const latest = deps.getTrackLoudness?.(trackId);
    return {
      ...loudness,
      manualGainDb: latest ? latest.manualGainDb : loudness.manualGainDb,
      manualCompressionStrength: latest
        ? latest.manualCompressionStrength
        : loudness.manualCompressionStrength,
    };
  };

  const runExecuteScanTrack = async (
    track: Track,
    options: ScanTrackOptions,
    entry: ScanEntry,
    generation: number,
  ): Promise<TrackLoudness> => {
    scanState.inFlightTrackIds.add(track.id);
    setPending(track);

    try {
      const settings = deps.getSettings();
      const fileMtime = options.mtimeMs ?? (await deps.statAudioFile(track.path)).mtimeMs;
      if (generation !== refreshScope()) return track.loudness ?? { status: 'pending' };
      const requestId = `loudness-${++requestSequence}-${track.id}`;
      entry.requestId = requestId;
      const result = await deps.analyzeLoudness(track.path, settings.loudnessTargetLufs, requestId);
      if (generation !== refreshScope()) return track.loudness ?? { status: 'pending' };
      if (scanEntries.get(track.id) !== entry) {
        return deps.getTrackLoudness?.(track.id) ?? track.loudness ?? { status: 'pending' };
      }
      if (options.cancelToken?.cancelled) {
        const previous = scanState.pendingPreviousLoudness.get(track.id);
        if (previous !== undefined) {
          deps.updateTrackLoudness(track.id, mergeManualSettings(track.id, previous));
          scanState.pendingPreviousLoudness.delete(track.id);
          return previous;
        }
        const cancelledLoudness: TrackLoudness = {
          status: 'pending',
          manualGainDb: deps.getTrackLoudness?.(track.id)?.manualGainDb,
          manualCompressionStrength: deps.getTrackLoudness?.(track.id)?.manualCompressionStrength,
          algorithmVersion: LOUDNESS_ALGORITHM_VERSION,
        };
        deps.updateTrackLoudness(track.id, cancelledLoudness);
        scanState.pendingPreviousLoudness.delete(track.id);
        return cancelledLoudness;
      }
      const loudness = mergeManualSettings(track.id, {
        ...mapAnalyzeResultToTrackLoudness(result, fileMtime),
        manualGainDb: track.loudness?.manualGainDb,
        manualCompressionStrength: track.loudness?.manualCompressionStrength,
      });
      deps.updateTrackLoudness(track.id, loudness);
      scanState.pendingPreviousLoudness.delete(track.id);
      return loudness;
    } catch (error) {
      if (generation !== refreshScope()) return track.loudness ?? { status: 'pending' };
      if (scanEntries.get(track.id) !== entry) {
        return deps.getTrackLoudness?.(track.id) ?? track.loudness ?? { status: 'pending' };
      }
      if (options.cancelToken?.cancelled) {
        const previous = scanState.pendingPreviousLoudness.get(track.id);
        const pending = previous
          ? mergeManualSettings(track.id, previous)
          : mergeManualSettings(track.id, { status: 'pending' });
        deps.updateTrackLoudness(track.id, pending);
        return pending;
      }
      const previous = scanState.pendingPreviousLoudness.get(track.id);
      const loudness: TrackLoudness = {
        ...(previous ?? {}),
        status: 'error',
        errorMessage: error instanceof Error ? error.message : 'Loudness scan failed',
        algorithmVersion: LOUDNESS_ALGORITHM_VERSION,
      };
      deps.updateTrackLoudness(track.id, mergeManualSettings(track.id, loudness));
      scanState.pendingPreviousLoudness.delete(track.id);
      return loudness;
    } finally {
      if (generation === refreshScope() && scanEntries.get(track.id) === entry) {
        scanState.inFlightTrackIds.delete(track.id);
        scanState.inFlightScanPromises.delete(track.id);
        scanEntries.delete(track.id);
      }
    }
  };

  const executeScanTrack = (track: Track, options: ScanTrackOptions): Promise<TrackLoudness> => {
    const existing = scanState.inFlightScanPromises.get(track.id);
    if (existing) return existing;

    const generation = refreshScope();
    const entry: ScanEntry = {
      promise: Promise.resolve({ status: 'pending' }),
      requestId: null,
    };
    scanEntries.set(track.id, entry);
    const scanPromise = Promise.resolve().then(() =>
      runExecuteScanTrack(track, options, entry, generation),
    );
    entry.promise = scanPromise;
    scanState.inFlightScanPromises.set(track.id, scanPromise);
    return scanPromise;
  };

  const scanTrack = async (
    track: Track,
    optionsOrMtime?: ScanTrackOptions | number,
    legacyCancelToken?: LoudnessCancelToken,
  ): Promise<TrackLoudness> => {
    const options: ScanTrackOptions =
      typeof optionsOrMtime === 'number'
        ? { mtimeMs: optionsOrMtime, cancelToken: legacyCancelToken }
        : (optionsOrMtime ?? {});
    const generation = refreshScope();
    const settings = deps.getSettings();
    if (!settings.loudnessNormalizationEnabled || !deps.canAnalyze()) {
      return (
        track.loudness ?? {
          status: 'error',
          errorMessage: 'Loudness analysis unavailable',
        }
      );
    }

    const inFlight = scanState.inFlightScanPromises.get(track.id);
    if (inFlight) return inFlight;

    if (scanState.scheduledTrackIds.has(track.id)) {
      await scanState.scanChain;
      if (generation !== refreshScope()) return track.loudness ?? { status: 'pending' };
      const afterChain = scanState.inFlightScanPromises.get(track.id);
      if (afterChain) return afterChain;
      const fromStore = deps.getTrackLoudness?.(track.id);
      if (fromStore) {
        return fromStore;
      }
      return track.loudness ?? buildPendingLoudness(track);
    }

    return executeScanTrack(track, options);
  };

  const runScanTracks = async (
    tracks: Track[],
    onProgress?: (progress: LoudnessScanProgress) => void,
    cancelToken?: LoudnessCancelToken,
  ): Promise<void> => {
    const settings = deps.getSettings();
    let completed = 0;

    for (const track of tracks) {
      if (cancelToken?.cancelled) {
        break;
      }

      let currentMtimeMs: number | undefined;
      try {
        const stat = await deps.statAudioFile(track.path);
        currentMtimeMs = stat.mtimeMs;
      } catch {
        currentMtimeMs = undefined;
      }

      if (!needsScan(track, settings, { currentMtimeMs }, needsScanContext())) {
        completed += 1;
        onProgress?.({ completed, total: tracks.length, track });
        continue;
      }

      await executeScanTrack(track, {
        mtimeMs: currentMtimeMs,
        cancelToken,
      });
      completed += 1;
      onProgress?.({ completed, total: tracks.length, track });

      if (cancelToken?.cancelled) {
        break;
      }
    }

    if (cancelToken?.cancelled) {
      restoreCancelledPending(scanState.pendingPreviousLoudness.keys());
    }
  };

  const scanTracks = (
    tracks: Track[],
    onProgress?: (progress: LoudnessScanProgress) => void,
    cancelToken?: LoudnessCancelToken,
  ): Promise<void> => {
    const novelTracks = tracks.filter(
      (track) =>
        !scanState.inFlightTrackIds.has(track.id) && !scanState.scheduledTrackIds.has(track.id),
    );

    if (novelTracks.length === 0) {
      return scanState.scanChain;
    }

    for (const track of novelTracks) {
      scanState.scheduledTrackIds.add(track.id);
    }

    scanState.scanChain = scanState.scanChain
      .then(() => runScanTracks(novelTracks, onProgress, cancelToken))
      .finally(() => {
        for (const track of novelTracks) {
          scanState.scheduledTrackIds.delete(track.id);
        }
      });

    return scanState.scanChain;
  };

  return {
    needsScan: (track: Track, options?: NeedsScanOptions) =>
      needsScan(track, deps.getSettings(), options, needsScanContext()),
    isMeasurementCurrent: async (track: Track) => {
      const generation = refreshScope();
      try {
        const stat = await deps.statAudioFile(track.path);
        if (generation !== refreshScope()) return false;
        const settings = deps.getSettings();
        return !needsScan(
          track,
          settings,
          { currentMtimeMs: stat.mtimeMs },
          { inFlightTrackIds: new Set() },
        );
      } catch {
        return false;
      }
    },
    resolveLinearGain: (track: Track) => resolveLinearGain(track, deps.getSettings()),
    scanTrack,
    scanTracks,
  };
};

const platformAudioAdapter = createDefaultPlatformAudioAdapter();

export const loudnessService = createLoudnessService({
  getScopeKey: () => useProjectStore.getState().projectScopeId,
  getSettings: () => {
    const state = useSettingsStore.getState();
    return {
      loudnessNormalizationEnabled: state.loudnessNormalizationEnabled,
      loudnessTargetLufs: state.loudnessTargetLufs,
      loudnessCompressionEnabled: state.loudnessCompressionEnabled,
      loudnessQuietGapRangeLu: state.loudnessQuietGapRangeLu,
    };
  },
  updateTrackLoudness: (trackId, loudness) => {
    useProjectStore.getState().updateTrackLoudness(trackId, loudness);
  },
  getTrackLoudness: (trackId) => {
    const item = useProjectStore.getState().findItemById(trackId);
    return item && isProjectTrack(item) ? item.loudness : undefined;
  },
  analyzeLoudness: async (path, targetLufs, requestId) => {
    const adapter = platformAudioAdapter as typeof platformAudioAdapter & {
      analyzeLoudness?: (
        filePath: string,
        target: number,
        id?: string,
      ) => Promise<LoudnessAnalyzeResult | null>;
    };
    const result = await adapter.analyzeLoudness?.(path, targetLufs, requestId);
    if (!result) {
      throw new Error('Loudness analysis unavailable');
    }
    return result;
  },
  cancelLoudnessScan: (requestId) => ipcService.cancelLoudnessScan(requestId),
  statAudioFile: async (path) => {
    const stat = await platformAudioAdapter.statAudioFile?.(path);
    if (!stat) {
      throw new Error('Audio file stat unavailable');
    }
    return stat;
  },
  canAnalyze: () => {
    try {
      return getPlatformCapabilities().supportsLoudnessAnalysis;
    } catch {
      return false;
    }
  },
});
