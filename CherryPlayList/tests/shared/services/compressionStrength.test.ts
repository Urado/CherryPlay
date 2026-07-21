import {
  LOUDNESS_ALGORITHM_VERSION,
  type Track,
  type TrackLoudness,
} from '../../../src/core/types/track';
import {
  COMPRESSION_BOOST_GATE_DB,
  COMPRESSION_BOOST_RANGE_DB,
  COMPRESSION_QUIET_GAP_RANGE_LU,
  getEffectiveCompressionStrength,
  resolveAutoCompressionStrength,
  resolveDynamicNeed,
  resolveQuietPassageLufs,
} from '../../../src/shared/audio/playback/compressionStrength';
import type { LoudnessSettings } from '../../../src/shared/contracts/loudness';

const enabledCompressionSettings: LoudnessSettings = {
  loudnessNormalizationEnabled: true,
  loudnessTargetLufs: -18,
  loudnessCompressionEnabled: true,
  loudnessQuietGapRangeLu: 15,
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

describe('resolveDynamicNeed', () => {
  it('returns 0 for narrow LRA', () => {
    expect(resolveDynamicNeed(createOkLoudness({ lraLu: 5 }))).toBe(0);
  });

  it('returns 1 for wide LRA', () => {
    expect(resolveDynamicNeed(createOkLoudness({ lraLu: 18 }))).toBe(1);
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

  it('returns 0 when quiet passages already meet target', () => {
    const track = createTrack(createOkLoudness({ lraLowLufs: -18, lraLu: 12 }));
    expect(resolveAutoCompressionStrength(track, enabledCompressionSettings)).toBe(0);
  });

  it('applies compression for negative gain when LRA is wide and quiet gap is large', () => {
    const track = createTrack(
      createOkLoudness({
        integratedLufs: -14,
        trackGainDb: -4,
        lraLowLufs: -18 - COMPRESSION_QUIET_GAP_RANGE_LU,
        lraLu: 18,
      }),
    );

    expect(resolveAutoCompressionStrength(track, enabledCompressionSettings)).toBeCloseTo(1, 5);
  });

  it('returns 0 for dense pop with small LRA even when quiet gap exists', () => {
    const track = createTrack(
      createOkLoudness({
        integratedLufs: -17,
        trackGainDb: -1,
        lraLowLufs: -22,
        lraLu: 5,
      }),
    );

    expect(resolveAutoCompressionStrength(track, enabledCompressionSettings)).toBe(0);
  });

  it('uses product of partial quiet and dynamic factors', () => {
    const track = createTrack(
      createOkLoudness({
        trackGainDb: -2,
        lraLowLufs: -18 - COMPRESSION_QUIET_GAP_RANGE_LU / 2,
        lraLu: 13,
      }),
    );

    expect(resolveAutoCompressionStrength(track, enabledCompressionSettings)).toBeCloseTo(0.25, 5);
  });

  it('boosts strength when positive gain exceeds gate', () => {
    const boostGainDb = COMPRESSION_BOOST_GATE_DB + COMPRESSION_BOOST_RANGE_DB / 2;
    const track = createTrack(
      createOkLoudness({
        // Recomputed auto gain must exceed boost gate (persisted trackGainDb alone is ignored).
        integratedLufs: -18 - boostGainDb,
        truePeakDb: -1 - boostGainDb,
        trackGainDb: 0,
        lraLowLufs: -18 - COMPRESSION_QUIET_GAP_RANGE_LU / 2,
        lraLu: 13,
      }),
    );

    expect(resolveAutoCompressionStrength(track, enabledCompressionSettings)).toBeCloseTo(0.375, 5);
  });

  it('uses softer quiet-gap threshold when range is wider', () => {
    const track = createTrack(
      createOkLoudness({
        trackGainDb: -2,
        lraLowLufs: -18 - 11,
        lraLu: 13,
      }),
    );

    expect(resolveAutoCompressionStrength(track, enabledCompressionSettings)).toBeCloseTo(
      0.3667,
      4,
    );
    expect(
      resolveAutoCompressionStrength(track, {
        ...enabledCompressionSettings,
        loudnessQuietGapRangeLu: 22,
      }),
    ).toBeCloseTo(0.25, 4);
  });

  it('uses tighter quiet-gap threshold when range is narrower', () => {
    const track = createTrack(
      createOkLoudness({
        trackGainDb: -2,
        lraLowLufs: -18 - 8,
        lraLu: 13,
      }),
    );

    expect(resolveAutoCompressionStrength(track, enabledCompressionSettings)).toBeCloseTo(
      0.2667,
      4,
    );
    expect(
      resolveAutoCompressionStrength(track, {
        ...enabledCompressionSettings,
        loudnessQuietGapRangeLu: 10,
      }),
    ).toBeCloseTo(0.4, 4);
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
        trackGainDb: -4,
        lraLowLufs: -18 - COMPRESSION_QUIET_GAP_RANGE_LU,
        lraLu: 18,
      }),
    );
    expect(getEffectiveCompressionStrength(track, enabledCompressionSettings)).toBeCloseTo(1, 5);
  });
});
