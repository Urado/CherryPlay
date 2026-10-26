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

import { LOUDNESS_ALGORITHM_VERSION, type Track, type TrackLoudness } from '../../../src/core/types/track';
import type { LoudnessAnalyzeResult } from '../../../src/shared/contracts/loudness';
import { createLoudnessService } from '../../../src/shared/services/loudnessService';

const deferred = <T>() => {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
};

const track: Track = {
  id: 'track-1',
  path: 'D:/Music/track.flac',
  name: 'Track',
};

const result: LoudnessAnalyzeResult = {
  status: 'ok',
  integratedLufs: -21,
  truePeakDb: -5,
  trackGainDb: 3,
  fileMtime: 100,
  algorithmVersion: LOUDNESS_ALGORITHM_VERSION,
};

describe('loudness in-flight scope and manual overrides', () => {
  it('preserves manual settings changed after analysis starts', async () => {
    const analysis = deferred<LoudnessAnalyzeResult>();
    let current: TrackLoudness | undefined;
    const analyzeLoudness = jest.fn(() => analysis.promise);
    const service = createLoudnessService({
      getSettings: () => ({
        loudnessNormalizationEnabled: true,
        loudnessTargetLufs: -18,
        loudnessCompressionEnabled: false,
        loudnessQuietGapRangeLu: 15,
      }),
      updateTrackLoudness: (_id, loudness) => {
        current = loudness;
      },
      getTrackLoudness: () => current,
      analyzeLoudness,
      statAudioFile: jest.fn().mockResolvedValue({ mtimeMs: 100, size: 1024 }),
      canAnalyze: () => true,
    });

    const scan = service.scanTrack(track, 100);
    for (let index = 0; index < 20 && analyzeLoudness.mock.calls.length === 0; index++) {
      await Promise.resolve();
    }
    expect(analyzeLoudness).toHaveBeenCalledTimes(1);
    current = { status: 'pending', manualGainDb: 5.5, manualCompressionStrength: 0.7 };
    analysis.resolve(result);
    await scan;

    expect(current).toEqual(
      expect.objectContaining({
        status: 'ok',
        manualGainDb: 5.5,
        manualCompressionStrength: 0.7,
      }),
    );
  });

  it('ignores an analysis result after the project scope changes', async () => {
    const analysis = deferred<LoudnessAnalyzeResult>();
    const updates: TrackLoudness[] = [];
    const analyzeLoudness = jest.fn(() => analysis.promise);
    let scope = 'project-a';
    const service = createLoudnessService({
      getSettings: () => ({
        loudnessNormalizationEnabled: true,
        loudnessTargetLufs: -18,
        loudnessCompressionEnabled: false,
        loudnessQuietGapRangeLu: 15,
      }),
      getScopeKey: () => scope,
      updateTrackLoudness: (_id, loudness) => updates.push(loudness),
      analyzeLoudness,
      statAudioFile: jest.fn().mockResolvedValue({ mtimeMs: 100, size: 1024 }),
      canAnalyze: () => true,
    });

    const scan = service.scanTrack(track, 100);
    for (let index = 0; index < 20 && analyzeLoudness.mock.calls.length === 0; index++) {
      await Promise.resolve();
    }
    expect(analyzeLoudness).toHaveBeenCalledTimes(1);
    scope = 'project-b';
    service.needsScan(track);
    analysis.resolve(result);
    await scan;

    expect(updates.some((loudness) => loudness.status === 'ok')).toBe(false);
  });
});
