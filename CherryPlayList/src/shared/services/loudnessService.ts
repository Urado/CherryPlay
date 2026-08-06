import { isProjectTrack } from '@core/types/project';
import { LOUDNESS_ALGORITHM_VERSION, type Track, type TrackLoudness } from '@core/types/track';

import { resolveLinearGain } from '../audio/loudnessGain';
import { createDefaultPlatformAudioAdapter } from '../audio/playback/createDefaultPlatformAudioAdapter';
import { TRACK_GAIN_LINEAR_MAX, TRACK_GAIN_LINEAR_MIN } from '../audio/playback/effects';
import type { LoudnessAnalyzeResult, LoudnessSettings } from '../contracts/loudness';
import { getPlatformCapabilities } from '../platform/platformCapabilities';
import { useProjectStore } from '../stores/projectStore';
import { useSettingsStore } from '../stores/settingsStore';

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

/**
 * Clears persisted `pending` on project load so stale in-progress markers trigger a rescan.
 */
export function normalizeLoadedLoudness(loudness: TrackLoudness): TrackLoudness | undefined {
  if (loudness.status === 'pending') {
    return undefined;
  }
  return loudness;
}

export function needsScan(
  track: Track,
  settings: Pick<LoudnessSettings, 'loudnessNormalizationEnabled'>,
  options?: NeedsScanOptions,
  context?: NeedsScanContext,
): boolean {
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
}

function mapAnalyzeResultToTrackLoudness(
  result: LoudnessAnalyzeResult,
  fileMtime: number,
): TrackLoudness {
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
}

export type LoudnessServiceDeps = {
  getSettings: () => LoudnessSettings;
  updateTrackLoudness: (trackId: string, loudness: TrackLoudness) => void;
  getTrackLoudness?: (trackId: string) => TrackLoudness | undefined;
  analyzeLoudness: (path: string, targetLufs: number) => Promise<LoudnessAnalyzeResult>;
  statAudioFile: (path: string) => Promise<{ mtimeMs: number; size: number }>;
  canAnalyze: () => boolean;
};

type ScanOrchestrationState = {
  inFlightTrackIds: Set<string>;
  inFlightScanPromises: Map<string, Promise<TrackLoudness>>;
  pendingPreviousLoudness: Map<string, TrackLoudness | undefined>;
  scheduledTrackIds: Set<string>;
  scanChain: Promise<void>;
};

function createScanOrchestration(): ScanOrchestrationState {
  return {
    inFlightTrackIds: new Set(),
    inFlightScanPromises: new Map(),
    pendingPreviousLoudness: new Map(),
    scheduledTrackIds: new Set(),
    scanChain: Promise.resolve(),
  };
}

export function createLoudnessService(deps: LoudnessServiceDeps) {
  const scanState = createScanOrchestration();

  const needsScanContext = (): NeedsScanContext => ({
    inFlightTrackIds: scanState.inFlightTrackIds,
  });

  const setPending = (track: Track): void => {
    scanState.pendingPreviousLoudness.set(track.id, track.loudness);
    deps.updateTrackLoudness(track.id, { ...track.loudness, status: 'pending' });
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
    } as TrackLoudness;
  };

  const runExecuteScanTrack = async (
    track: Track,
    mtimeMs?: number,
    cancelToken?: LoudnessCancelToken,
  ): Promise<TrackLoudness> => {
    scanState.inFlightTrackIds.add(track.id);
    setPending(track);

    try {
      const settings = deps.getSettings();
      const fileMtime = mtimeMs ?? (await deps.statAudioFile(track.path)).mtimeMs;
      const result = await deps.analyzeLoudness(track.path, settings.loudnessTargetLufs);
      if (cancelToken?.cancelled) {
        const previous = scanState.pendingPreviousLoudness.get(track.id);
        if (previous !== undefined) {
          deps.updateTrackLoudness(track.id, previous);
          scanState.pendingPreviousLoudness.delete(track.id);
          return previous;
        }
        const cancelledLoudness: TrackLoudness = {
          status: 'error',
          errorMessage: 'Scan cancelled',
          algorithmVersion: LOUDNESS_ALGORITHM_VERSION,
        };
        deps.updateTrackLoudness(track.id, cancelledLoudness);
        scanState.pendingPreviousLoudness.delete(track.id);
        return cancelledLoudness;
      }
      const loudness = {
        ...mapAnalyzeResultToTrackLoudness(result, fileMtime),
        manualGainDb: track.loudness?.manualGainDb,
        manualCompressionStrength: track.loudness?.manualCompressionStrength,
      };
      deps.updateTrackLoudness(track.id, loudness);
      scanState.pendingPreviousLoudness.delete(track.id);
      return loudness;
    } catch (error) {
      const loudness: TrackLoudness = {
        status: 'error',
        errorMessage: error instanceof Error ? error.message : 'Loudness scan failed',
        algorithmVersion: LOUDNESS_ALGORITHM_VERSION,
      };
      deps.updateTrackLoudness(track.id, loudness);
      scanState.pendingPreviousLoudness.delete(track.id);
      return loudness;
    } finally {
      scanState.inFlightTrackIds.delete(track.id);
      scanState.inFlightScanPromises.delete(track.id);
    }
  };

  const executeScanTrack = (
    track: Track,
    mtimeMs?: number,
    cancelToken?: LoudnessCancelToken,
  ): Promise<TrackLoudness> => {
    const existing = scanState.inFlightScanPromises.get(track.id);
    if (existing) {
      return existing;
    }

    const scanPromise = runExecuteScanTrack(track, mtimeMs, cancelToken);
    scanState.inFlightScanPromises.set(track.id, scanPromise);
    return scanPromise;
  };

  const scanTrack = async (
    track: Track,
    mtimeMs?: number,
    cancelToken?: LoudnessCancelToken,
  ): Promise<TrackLoudness> => {
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
    if (inFlight) {
      return inFlight;
    }

    if (scanState.scheduledTrackIds.has(track.id)) {
      await scanState.scanChain;
      const afterChain = scanState.inFlightScanPromises.get(track.id);
      if (afterChain) {
        return afterChain;
      }
      const fromStore = deps.getTrackLoudness?.(track.id);
      if (fromStore) {
        return fromStore;
      }
      return track.loudness ?? buildPendingLoudness(track);
    }

    return executeScanTrack(track, mtimeMs, cancelToken);
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

      await executeScanTrack(track, currentMtimeMs, cancelToken);
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
    resolveLinearGain: (track: Track) => resolveLinearGain(track, deps.getSettings()),
    scanTrack,
    scanTracks,
  };
}

const platformAudioAdapter = createDefaultPlatformAudioAdapter();

export const loudnessService = createLoudnessService({
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
  analyzeLoudness: async (path, targetLufs) => {
    const result = await platformAudioAdapter.analyzeLoudness?.(path, targetLufs);
    if (!result) {
      throw new Error('Loudness analysis unavailable');
    }
    return result;
  },
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
