jest.mock('../../../src/shared/services/ipcService', () => ({
  ipcService: { analyzeLoudness: jest.fn(), statAudioFile: jest.fn() },
}));

jest.mock('../../../src/shared/stores/projectStore', () => ({
  useProjectStore: { getState: jest.fn(() => ({ updateTrackLoudness: jest.fn() })) },
}));

jest.mock('../../../src/shared/stores/settingsStore', () => ({
  useSettingsStore: {
    getState: jest.fn(() => ({
      loudnessNormalizationEnabled: true,
      loudnessTargetLufs: -18,
      loudnessCompressionEnabled: false,
      loudnessQuietGapRangeLu: 15,
    })),
  },
}));

jest.mock('../../../src/shared/platform/platformCapabilities', () => ({
  getPlatformCapabilities: jest.fn(() => ({ supportsLoudnessAnalysis: true })),
}));

jest.mock('../../../src/shared/audio/playback/createDefaultPlatformAudioAdapter', () => ({
  createDefaultPlatformAudioAdapter: jest.fn(() => ({
    analyzeLoudness: jest.fn(),
    statAudioFile: jest.fn(),
  })),
}));

import { LOUDNESS_ALGORITHM_VERSION } from '../../../src/core/types/track';
import type { Track, TrackLoudness } from '../../../src/core/types/track';
import type {
  LoudnessAnalyzeResult,
  LoudnessSettings,
} from '../../../src/shared/contracts/loudness';
import {
  createLoudnessService,
  normalizeLoadedLoudness,
} from '../../../src/shared/services/loudnessService';
import { areGateTracksReady } from '../../../src/shared/utils/loudnessSessionGate';

const settings: LoudnessSettings = {
  loudnessNormalizationEnabled: true,
  loudnessTargetLufs: -18,
  loudnessCompressionEnabled: false,
  loudnessQuietGapRangeLu: 15,
};

const result: LoudnessAnalyzeResult = {
  status: 'ok',
  integratedLufs: -21,
  truePeakDb: -5,
  trackGainDb: 3,
  fileMtime: 100,
  algorithmVersion: LOUDNESS_ALGORITHM_VERSION,
};

const deferred = <T>() => {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
};

describe('loudness scan writes against current track metadata', () => {
  it('keeps manual gain and compression edits made while analysis is running', async () => {
    const track: Track = {
      id: 'track-1',
      path: 'D:/Music/track.flac',
      name: 'Track',
      loudness: { status: 'pending', manualGainDb: 7, manualCompressionStrength: 0.8 },
    };
    const analysis = deferred<LoudnessAnalyzeResult>();
    let current: TrackLoudness | undefined = track.loudness;
    const service = createLoudnessService({
      getSettings: () => settings,
      updateTrackLoudness: (_id, loudness) => {
        current = loudness;
      },
      getTrackLoudness: () => current,
      analyzeLoudness: () => analysis.promise,
      statAudioFile: jest.fn().mockResolvedValue({ mtimeMs: 100, size: 1024 }),
      canAnalyze: () => true,
    });

    const scan = service.scanTrack(track, 100);
    analysis.resolve(result);
    await scan;

    expect(current).toEqual(
      expect.objectContaining({
        status: 'ok',
        manualGainDb: 7,
        manualCompressionStrength: 0.8,
      }),
    );
  });

  it('keeps successful results and manual settings when a later queued scan is cancelled', async () => {
    const first: Track = {
      id: 'completed-before-cancel',
      path: 'D:/Music/first.flac',
      name: 'First',
      loudness: {
        status: 'error',
        errorMessage: 'stale result',
        manualGainDb: 4.5,
        manualCompressionStrength: 0.65,
      },
    };
    const second: Track = { id: 'cancelled-track', path: 'D:/Music/second.flac', name: 'Second' };
    const secondAnalysis = deferred<LoudnessAnalyzeResult>();
    const loudnessById = new Map<string, TrackLoudness | undefined>([[first.id, first.loudness]]);
    let secondAnalysisStarted = false;
    const service = createLoudnessService({
      getSettings: () => settings,
      updateTrackLoudness: (id, loudness) => loudnessById.set(id, loudness),
      getTrackLoudness: (id) => loudnessById.get(id),
      analyzeLoudness: (path) => {
        if (path === first.path) return Promise.resolve(result);
        secondAnalysisStarted = true;
        return secondAnalysis.promise;
      },
      statAudioFile: jest.fn().mockResolvedValue({ mtimeMs: 100, size: 1024 }),
      canAnalyze: () => true,
    });
    const cancellation = { cancelled: false };
    const scan = service.scanTracks([first, second], undefined, cancellation);
    for (let index = 0; index < 30 && loudnessById.get(first.id)?.status !== 'ok'; index++) {
      await Promise.resolve();
    }
    expect(loudnessById.get(first.id)).toEqual(
      expect.objectContaining({
        status: 'ok',
        manualGainDb: 4.5,
        manualCompressionStrength: 0.65,
      }),
    );
    for (let index = 0; index < 30 && !secondAnalysisStarted; index++) {
      await Promise.resolve();
    }
    expect(secondAnalysisStarted).toBe(true);
    cancellation.cancelled = true;
    secondAnalysis.resolve(result);
    await scan;

    const cancelled = loudnessById.get(second.id);
    expect(cancelled?.status).not.toBe('ok');
    expect(cancelled?.errorMessage).not.toBe('Scan cancelled');
    expect(areGateTracksReady(cancelled ? [{ ...second, loudness: cancelled }] : [second])).toBe(
      false,
    );
  });

  it('preserves manual settings when normalizing a persisted pending value', () => {
    expect(
      normalizeLoadedLoudness({
        status: 'pending',
        manualGainDb: 4.5,
        manualCompressionStrength: 0.65,
      }),
    ).toEqual({
      status: 'pending',
      manualGainDb: 4.5,
      manualCompressionStrength: 0.65,
    });
  });
});
