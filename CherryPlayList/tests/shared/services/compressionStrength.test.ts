import {
  LOUDNESS_ALGORITHM_VERSION,
  type Track,
  type TrackLoudness,
} from '../../../src/core/types/track';
import {
  COMPRESSION_GAIN_RANGE_DB,
  COMPRESSION_QUIET_GAP_RANGE_LU,
  getEffectiveCompressionStrength,
  resolveAutoCompressionStrength,
  resolveQuietPassageLufs,
} from '../../../src/shared/audio/playback/compressionStrength';
import type { LoudnessSettings } from '../../../src/shared/contracts/loudness';

const enabledCompressionSettings: LoudnessSettings = {
  loudnessNormalizationEnabled: true,
  loudnessTargetLufs: -18,
  loudnessCompressionEnabled: true,
};

function createOkLoudness(overrides: Partial<TrackLoudness> = {}): TrackLoudness {
  return {
    status: 'ok',
    integratedLufs: -20,
    lraLowLufs: -28,
    lraLu: 8,
    truePeakDb: -3,
    trackGainDb: 6,
    fileMtime: 1000,
    algorithmVersion: LOUDNESS_ALGORITHM_VERSION,
    ...overrides,
  };
}

function createTrack(loudness: TrackLoudness): Track {
  return {
    id: 'track-1',
    path: 'D:/Music/track.flac',
    name: 'Track',
    loudness,
  };
}

describe('resolveQuietPassageLufs', () => {
  it('prefers LRA low from scan metadata', () => {
    expect(resolveQuietPassageLufs(createOkLoudness({ lraLowLufs: -30 }))).toBe(-30);
  });

  it('estimates quiet passages from integrated and LRA when LRA low is missing', () => {
    expect(
      resolveQuietPassageLufs(
        createOkLoudness({ lraLowLufs: undefined, integratedLufs: -20, lraLu: 10 }),
      ),
    ).toBeCloseTo(-25.5, 5);
  });
});

describe('resolveAutoCompressionStrength', () => {
  it('returns 0 when compression toggle is off', () => {
    const track = createTrack(createOkLoudness());
    expect(
      resolveAutoCompressionStrength(track, {
        ...enabledCompressionSettings,
        loudnessCompressionEnabled: false,
      }),
    ).toBe(0);
  });

  it('returns 0 when gain is unity', () => {
    const track = createTrack(createOkLoudness({ trackGainDb: 0 }));
    expect(resolveAutoCompressionStrength(track, enabledCompressionSettings)).toBe(0);
  });

  it('scales with gain deviation and quiet-passage gap', () => {
    const track = createTrack(
      createOkLoudness({
        trackGainDb: COMPRESSION_GAIN_RANGE_DB,
        lraLowLufs: -18 - COMPRESSION_QUIET_GAP_RANGE_LU,
      }),
    );

    expect(resolveAutoCompressionStrength(track, enabledCompressionSettings)).toBeCloseTo(1, 5);
  });

  it('uses product of partial gain and quiet factors', () => {
    const track = createTrack(
      createOkLoudness({
        trackGainDb: COMPRESSION_GAIN_RANGE_DB / 2,
        lraLowLufs: -18 - COMPRESSION_QUIET_GAP_RANGE_LU / 2,
      }),
    );

    expect(resolveAutoCompressionStrength(track, enabledCompressionSettings)).toBeCloseTo(0.25, 5);
  });
});

describe('getEffectiveCompressionStrength', () => {
  it('uses manual override when set', () => {
    const track = createTrack(createOkLoudness({ manualCompressionStrength: 0.75 }));
    expect(getEffectiveCompressionStrength(track, enabledCompressionSettings)).toBe(0.75);
  });

  it('falls back to auto calculation without manual override', () => {
    const track = createTrack(
      createOkLoudness({
        trackGainDb: COMPRESSION_GAIN_RANGE_DB,
        lraLowLufs: -18 - COMPRESSION_QUIET_GAP_RANGE_LU,
      }),
    );
    expect(getEffectiveCompressionStrength(track, enabledCompressionSettings)).toBeCloseTo(1, 5);
  });
});
