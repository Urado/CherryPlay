/**
 * @jest-environment node
 */

import {
  computeTrackGainDb,
  DEFAULT_TARGET_LUFS,
  HEADROOM_DB_TP,
  parseEbur128Summary,
} from '../../electron/audio/loudnessScanner';

const EBUR128_SUMMARY_FIXTURE = `
[Parsed_ebur128_0 @ 0x1d69ce0] t: 401.3      M:-142.9 S: -20.7     I: -17.7 LUFS     LRA:   8.1 LU
size=N/A time=00:06:41.40 bitrate=N/A
video:0kB audio:75264kB subtitle:0 global headers:0kB muxing overhead -100.000029%
Summary:

  Integrated loudness:
    I:         -17.7 LUFS
    Threshold: -28.3 LUFS

  Loudness range:
    LRA:         8.1 LU
    Threshold: -38.3 LUFS
    LRA low:   -23.1 LUFS
    LRA high:  -15.0 LUFS

  True peak:
    Peak:       -0.4 dBFS
`;

const EBUR128_DBTP_FIXTURE = `
Summary:

  Integrated loudness:
    I:         -23.0 LUFS
    Threshold: -33.0 LUFS

  Loudness range:
    LRA:         0.0 LU

  True peak:
    Peak:       -2.3 dBTP
`;

const EBUR128_MULTICHANNEL_TPK_FIXTURE = `
Summary:

  Integrated loudness:
    I:         -18.5 LUFS

  True peak:
    TPK:  -3.2  -1.1 dBFS
`;

describe('parseEbur128Summary', () => {
  test('parses integrated LUFS and true peak from Summary fixture', () => {
    const result = parseEbur128Summary(EBUR128_SUMMARY_FIXTURE);

    expect(result).toEqual({
      integratedLufs: -17.7,
      lraLowLufs: -23.1,
      lraLu: 8.1,
      truePeakDb: -0.4,
    });
  });

  test('parses dBTP true peak label', () => {
    const result = parseEbur128Summary(EBUR128_DBTP_FIXTURE);

    expect(result).toEqual({
      integratedLufs: -23,
      lraLu: 0,
      truePeakDb: -2.3,
    });
  });

  test('prefers dBTP over dBFS when both peak labels are present', () => {
    const stderr = `
Summary:

  Integrated loudness:
    I:         -18.0 LUFS

  True peak:
    Peak:       -0.4 dBFS
    Peak:       -2.3 dBTP
`;

    const result = parseEbur128Summary(stderr);

    expect(result).toEqual({
      integratedLufs: -18,
      truePeakDb: -2.3,
    });
  });

  test('uses max channel TPK for multichannel output', () => {
    const result = parseEbur128Summary(EBUR128_MULTICHANNEL_TPK_FIXTURE);

    expect(result).toEqual({
      integratedLufs: -18.5,
      truePeakDb: -1.1,
    });
  });

  test('falls back to last streaming I: value when Summary integrated block is missing', () => {
    const stderr = `
[Parsed_ebur128_0 @ 0xabc] t: 1.0 M:-20.0 S:-20.0 I: -22.5 LUFS LRA: 1.0 LU
[Parsed_ebur128_0 @ 0xabc] t: 2.0 M:-19.0 S:-19.0 I: -21.0 LUFS LRA: 1.0 LU
True peak:
  Peak:       -4.0 dBFS
`;

    const result = parseEbur128Summary(stderr);

    expect(result).toEqual({
      integratedLufs: -21,
      truePeakDb: -4,
    });
  });

  test('returns null for empty stderr', () => {
    expect(parseEbur128Summary('')).toBeNull();
  });

  test('returns null when integrated loudness is out of sane range', () => {
    const stderr = `
Summary:
  Integrated loudness:
    I:         -120.0 LUFS
  True peak:
    Peak:       -1.0 dBFS
`;

    expect(parseEbur128Summary(stderr)).toBeNull();
  });

  test('returns null when true peak is out of sane range', () => {
    const stderr = `
Summary:
  Integrated loudness:
    I:         -18.0 LUFS
  True peak:
    Peak:       25.0 dBFS
`;

    expect(parseEbur128Summary(stderr)).toBeNull();
  });
});

describe('computeTrackGainDb', () => {
  test('applies target LUFS offset when headroom allows', () => {
    expect(computeTrackGainDb(-23, -6, DEFAULT_TARGET_LUFS, HEADROOM_DB_TP)).toBe(5);
  });

  test('caps gain to respect −1 dBTP headroom', () => {
    expect(computeTrackGainDb(-23, -2, DEFAULT_TARGET_LUFS, HEADROOM_DB_TP)).toBe(1);
  });

  test('reduces gain when true peak already exceeds headroom', () => {
    expect(computeTrackGainDb(-20, 0.5, DEFAULT_TARGET_LUFS, HEADROOM_DB_TP)).toBe(-1.5);
  });

  test('uses smaller of LUFS offset and headroom cap', () => {
    expect(computeTrackGainDb(-20, -5, DEFAULT_TARGET_LUFS, HEADROOM_DB_TP)).toBe(2);
  });

  test('respects custom target LUFS', () => {
    expect(computeTrackGainDb(-16, -6, -14, HEADROOM_DB_TP)).toBe(2);
  });
});
