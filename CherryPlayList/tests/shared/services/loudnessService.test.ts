jest.mock('../../../src/shared/services/ipcService', () => ({
  ipcService: {
    analyzeLoudness: jest.fn(),
    statAudioFile: jest.fn(),
  },
}));

jest.mock('../../../src/shared/stores/projectStore', () => ({
  useProjectStore: {
    getState: jest.fn(() => ({ updateTrackLoudness: jest.fn() })),
  },
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

import {
  LOUDNESS_ALGORITHM_VERSION,
  type Track,
  type TrackLoudness,
} from '../../../src/core/types/track';
import { getEffectiveGainDb, resolveLinearGain } from '../../../src/shared/audio/loudnessGain';
import {
  TRACK_GAIN_LINEAR_MAX,
  TRACK_GAIN_LINEAR_MIN,
} from '../../../src/shared/audio/playback/effects';
import type { LoudnessSettings } from '../../../src/shared/contracts/loudness';
import {
  createLoudnessService,
  needsScan,
  normalizeLoadedLoudness,
} from '../../../src/shared/services/loudnessService';

const enabledSettings: LoudnessSettings = {
  loudnessNormalizationEnabled: true,
  loudnessTargetLufs: -18,
  loudnessCompressionEnabled: false,
  loudnessQuietGapRangeLu: 15,
};

const disabledSettings: LoudnessSettings = {
  ...enabledSettings,
  loudnessNormalizationEnabled: false,
};

function createTrack(overrides: Partial<Track> = {}): Track {
  return {
    id: 'track-1',
    path: 'D:/Music/track.flac',
    name: 'Track',
    ...overrides,
  };
}

function createOkLoudness(overrides: Partial<TrackLoudness> = {}): TrackLoudness {
  return {
    status: 'ok',
    integratedLufs: -20,
    truePeakDb: -3,
    trackGainDb: 2,
    fileMtime: 1000,
    algorithmVersion: LOUDNESS_ALGORITHM_VERSION,
    ...overrides,
  };
}

describe('normalizeLoadedLoudness', () => {
  it('drops persisted pending so tracks are rescanned', () => {
    expect(normalizeLoadedLoudness({ status: 'pending' })).toBeUndefined();
  });

  it('keeps ok loudness metadata', () => {
    const loudness = createOkLoudness();
    expect(normalizeLoadedLoudness(loudness)).toEqual(loudness);
  });
});

describe('resolveLinearGain', () => {
  it('returns 1 when normalization is disabled', () => {
    const track = createTrack({ loudness: createOkLoudness({ trackGainDb: 6 }) });
    expect(resolveLinearGain(track, disabledSettings)).toBe(1);
  });

  it('returns 1 when loudness is missing', () => {
    expect(resolveLinearGain(createTrack(), enabledSettings)).toBe(1);
  });

  it('returns 1 when loudness status is not ok', () => {
    const track = createTrack({
      loudness: { status: 'error', errorMessage: 'scan failed' },
    });
    expect(resolveLinearGain(track, enabledSettings)).toBe(1);
  });

  it('converts trackGainDb to linear gain', () => {
    const track = createTrack({ loudness: createOkLoudness({ trackGainDb: 6 }) });
    expect(resolveLinearGain(track, enabledSettings)).toBeCloseTo(10 ** (6 / 20), 5);
  });

  it('clamps linear gain to engine maximum', () => {
    const track = createTrack({ loudness: createOkLoudness({ trackGainDb: 40 }) });
    expect(resolveLinearGain(track, enabledSettings)).toBeCloseTo(TRACK_GAIN_LINEAR_MAX, 5);
  });

  it('attenuates tracks with negative trackGainDb', () => {
    const track = createTrack({ loudness: createOkLoudness({ trackGainDb: -6 }) });
    expect(resolveLinearGain(track, enabledSettings)).toBeCloseTo(10 ** (-6 / 20), 5);
    expect(resolveLinearGain(track, enabledSettings)).toBeGreaterThanOrEqual(TRACK_GAIN_LINEAR_MIN);
  });

  it('uses manualGainDb override instead of trackGainDb', () => {
    const track = createTrack({
      loudness: createOkLoudness({ trackGainDb: 2, manualGainDb: -4 }),
    });
    expect(getEffectiveGainDb(track)).toBe(-4);
    expect(resolveLinearGain(track, enabledSettings)).toBeCloseTo(10 ** (-4 / 20), 5);
  });
});

describe('needsScan', () => {
  it('returns false when normalization is disabled', () => {
    expect(needsScan(createTrack(), disabledSettings)).toBe(false);
  });

  it('returns true when loudness is missing', () => {
    expect(needsScan(createTrack(), enabledSettings)).toBe(true);
  });

  it('returns true when persisted scan is pending and not in-flight', () => {
    const track = createTrack({ loudness: { status: 'pending' } });
    expect(needsScan(track, enabledSettings)).toBe(true);
  });

  it('returns false when scan is pending and actively in-flight', () => {
    const track = createTrack({ loudness: { status: 'pending' } });
    expect(
      needsScan(track, enabledSettings, undefined, { inFlightTrackIds: new Set(['track-1']) }),
    ).toBe(false);
  });

  it('returns true when loudness status is error', () => {
    const track = createTrack({ loudness: { status: 'error', errorMessage: 'failed' } });
    expect(needsScan(track, enabledSettings)).toBe(true);
  });

  it('returns true when algorithmVersion does not match current version', () => {
    const track = createTrack({
      loudness: createOkLoudness({ algorithmVersion: 0 as typeof LOUDNESS_ALGORITHM_VERSION }),
    });
    expect(needsScan(track, enabledSettings)).toBe(true);
  });

  it('returns true when fileMtime is stale compared to statAudioFile mtimeMs', () => {
    const track = createTrack({ loudness: createOkLoudness({ fileMtime: 1000 }) });
    expect(needsScan(track, enabledSettings, { currentMtimeMs: 2000 })).toBe(true);
  });

  it('returns true when status is ok but fileMtime is missing and mtimeMs is available', () => {
    const track = createTrack({ loudness: createOkLoudness({ fileMtime: undefined }) });
    expect(needsScan(track, enabledSettings, { currentMtimeMs: 1500 })).toBe(true);
  });

  it('returns false when fileMtime matches statAudioFile mtimeMs', () => {
    const track = createTrack({ loudness: createOkLoudness({ fileMtime: 1500 }) });
    expect(needsScan(track, enabledSettings, { currentMtimeMs: 1500 })).toBe(false);
  });

  it('returns false for valid loudness without mtime context', () => {
    const track = createTrack({ loudness: createOkLoudness() });
    expect(needsScan(track, enabledSettings)).toBe(false);
  });
});

describe('createLoudnessService', () => {
  const okResult = {
    status: 'ok' as const,
    integratedLufs: -18,
    truePeakDb: -2,
    trackGainDb: 1,
    fileMtime: 2000,
  };

  function createService(overrides: Partial<Parameters<typeof createLoudnessService>[0]> = {}) {
    const loudnessByTrackId = new Map<string, TrackLoudness>();
    const updateTrackLoudness = jest.fn((trackId: string, loudness: TrackLoudness) => {
      loudnessByTrackId.set(trackId, loudness);
    });
    const analyzeLoudness = jest.fn().mockResolvedValue(okResult);
    const statAudioFile = jest.fn().mockResolvedValue({ mtimeMs: 2000, size: 1024 });

    const service = createLoudnessService({
      getSettings: () => enabledSettings,
      updateTrackLoudness,
      getTrackLoudness: (trackId) => loudnessByTrackId.get(trackId),
      analyzeLoudness,
      statAudioFile,
      canAnalyze: () => true,
      ...overrides,
    });

    return { service, updateTrackLoudness, analyzeLoudness, statAudioFile, loudnessByTrackId };
  }

  it('scanTrack is a no-op when normalization is disabled', async () => {
    const track = createTrack({ loudness: createOkLoudness() });
    const { service, updateTrackLoudness, analyzeLoudness } = createService({
      getSettings: () => disabledSettings,
    });

    const result = await service.scanTrack(track);

    expect(result).toEqual(track.loudness);
    expect(updateTrackLoudness).not.toHaveBeenCalled();
    expect(analyzeLoudness).not.toHaveBeenCalled();
  });

  it('setPending merges existing loudness fields', async () => {
    const existing = createOkLoudness({ trackGainDb: 4 });
    const track = createTrack({ loudness: existing });
    const { service, updateTrackLoudness } = createService();

    await service.scanTrack(track);

    expect(updateTrackLoudness).toHaveBeenCalledWith(track.id, {
      ...existing,
      status: 'pending',
    });
  });

  it('scanTrack reuses mtimeMs from scanTracks and avoids a second stat', async () => {
    const track = createTrack();
    const { service, statAudioFile } = createService();

    await service.scanTracks([track]);

    expect(statAudioFile).toHaveBeenCalledTimes(1);
  });

  it('scanTracks restores previous loudness when cancelled after analyze', async () => {
    const existing = createOkLoudness({ trackGainDb: 3 });
    const track = createTrack({ loudness: existing });
    const cancelToken = { cancelled: false };
    const { service, updateTrackLoudness, analyzeLoudness } = createService();

    analyzeLoudness.mockImplementation(async () => {
      cancelToken.cancelled = true;
      return okResult;
    });

    await service.scanTracks([track], undefined, cancelToken);

    expect(updateTrackLoudness).toHaveBeenCalledWith(track.id, existing);
  });

  it('deduplicates concurrent scanTracks calls for the same track', async () => {
    const track = createTrack();
    const { service, analyzeLoudness } = createService();

    await Promise.all([service.scanTracks([track]), service.scanTracks([track])]);

    expect(analyzeLoudness).toHaveBeenCalledTimes(1);
  });

  it('deduplicates concurrent scanTrack calls for the same track', async () => {
    const track = createTrack();
    const { service, analyzeLoudness } = createService();

    const [first, second] = await Promise.all([service.scanTrack(track), service.scanTrack(track)]);

    expect(analyzeLoudness).toHaveBeenCalledTimes(1);
    expect(first.status).toBe('ok');
    expect(second.status).toBe('ok');
    expect(first).toEqual(second);
  });

  it('deduplicates scanTrack while scanTracks batch is in-flight for the same track', async () => {
    const track = createTrack();
    let releaseAnalyze: (() => void) | undefined;
    const analyzeGate = new Promise<void>((resolve) => {
      releaseAnalyze = resolve;
    });
    const gatedAnalyzeLoudness = jest.fn().mockImplementation(async () => {
      await analyzeGate;
      return okResult;
    });
    const { service } = createService({ analyzeLoudness: gatedAnalyzeLoudness });

    const batchPromise = service.scanTracks([track]);
    await Promise.resolve();
    const singlePromise = service.scanTrack(track);

    releaseAnalyze?.();
    const [batchResult, singleResult] = await Promise.all([batchPromise, singlePromise]);

    expect(gatedAnalyzeLoudness).toHaveBeenCalledTimes(1);
    expect(singleResult.status).toBe('ok');
    expect(singleResult.integratedLufs).toBe(okResult.integratedLufs);
    expect(batchResult).toBeUndefined();
  });

  it('does not deadlock when scanTrack awaits a batch-driven executeScanTrack', async () => {
    const track = createTrack();
    const { service, analyzeLoudness } = createService();

    await expect(
      Promise.race([
        Promise.all([service.scanTracks([track]), service.scanTrack(track)]),
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('deadlock')), 2000);
        }),
      ]),
    ).resolves.toBeDefined();

    expect(analyzeLoudness).toHaveBeenCalledTimes(1);
  });
});
