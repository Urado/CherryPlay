import type { Track, TrackLoudness } from '@core/types/track';

import {
  clampLoudnessQuietGapRangeLu,
  COMPRESSION_QUIET_GAP_RANGE_LU,
  DEFAULT_LOUDNESS_QUIET_GAP_RANGE_LU,
  type LoudnessSettings,
} from '../../contracts/loudness';
import { getEffectiveGainDb } from '../loudnessGain';

/** Fallback quiet-passage offset when only integrated LUFS is available. */
export const COMPRESSION_INTEGRATED_ONLY_QUIET_OFFSET_LU = 6;
export { COMPRESSION_QUIET_GAP_RANGE_LU };
/** Estimate quiet-passage loudness from LRA when {@link TrackLoudness.lraLowLufs} is missing. */
export const COMPRESSION_LRA_QUIET_ESTIMATE_FACTOR = 0.55;
/** LRA below this LU is treated as already compressed (dense pop / brickwall). */
export const COMPRESSION_LRA_MIN_LU = 8;
/** Full {@link resolveDynamicNeed} when LRA span reaches MIN + this many LU. */
export const COMPRESSION_LRA_RANGE_LU = 10;
/** Positive gain above this dB adds extra strength (boost exaggerates internal contrast). */
export const COMPRESSION_BOOST_GATE_DB = 3;
/** Full boost multiplier span above {@link COMPRESSION_BOOST_GATE_DB}. */
export const COMPRESSION_BOOST_RANGE_DB = 12;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** Quiet-gap span for full quietNeed from global settings (5…30 LU). */
export function resolveQuietGapRangeLu(settings: LoudnessSettings): number {
  return clampLoudnessQuietGapRangeLu(
    settings.loudnessQuietGapRangeLu ?? DEFAULT_LOUDNESS_QUIET_GAP_RANGE_LU,
  );
}

/**
 * Estimates loudness of quiet passages for compression strength.
 * Prefers ebur128 LRA low (10th percentile); falls back to integrated − 0.55×LRA.
 */
export function resolveQuietPassageLufs(loudness: TrackLoudness): number | undefined {
  if (loudness.lraLowLufs !== undefined) {
    return loudness.lraLowLufs;
  }

  if (loudness.lraLu !== undefined && loudness.integratedLufs !== undefined) {
    return loudness.integratedLufs - loudness.lraLu * COMPRESSION_LRA_QUIET_ESTIMATE_FACTOR;
  }

  if (loudness.integratedLufs !== undefined) {
    return loudness.integratedLufs - COMPRESSION_INTEGRATED_ONLY_QUIET_OFFSET_LU;
  }

  return undefined;
}

/**
 * How wide the programme dynamics are (0…1). Uses LRA when available, else integrated − LRA low.
 */
export function resolveDynamicNeed(loudness: TrackLoudness): number {
  if (loudness.lraLu !== undefined) {
    return clamp01((loudness.lraLu - COMPRESSION_LRA_MIN_LU) / COMPRESSION_LRA_RANGE_LU);
  }

  if (loudness.integratedLufs !== undefined && loudness.lraLowLufs !== undefined) {
    const spreadLu = loudness.integratedLufs - loudness.lraLowLufs;
    return clamp01((spreadLu - COMPRESSION_LRA_MIN_LU) / COMPRESSION_LRA_RANGE_LU);
  }

  return 1;
}

/**
 * Auto-calculated compression strength in 0…1 from quiet-passage gap and LRA (EBU LRA block).
 * Compression runs before linear gain in playback; strength does not use |gainDb| as a driver.
 * Ignores {@link TrackLoudness.manualCompressionStrength}.
 */
export function resolveAutoCompressionStrength(track: Track, settings: LoudnessSettings): number {
  if (!settings.loudnessNormalizationEnabled || !settings.loudnessCompressionEnabled) {
    return 0;
  }

  const loudness = track.loudness;
  if (!loudness || loudness.status !== 'ok') {
    return 0;
  }

  const quietPassageLufs = resolveQuietPassageLufs(loudness);
  if (quietPassageLufs === undefined) {
    return 0;
  }

  const quietGapLu = settings.loudnessTargetLufs - quietPassageLufs;
  if (quietGapLu <= 0) {
    return 0;
  }

  const quietNeed = clamp01(quietGapLu / resolveQuietGapRangeLu(settings));
  const dynamicNeed = resolveDynamicNeed(loudness);
  let strength = quietNeed * dynamicNeed;

  const gainDb = getEffectiveGainDb(track, settings);
  if (gainDb !== undefined && gainDb > COMPRESSION_BOOST_GATE_DB) {
    const boostFactor =
      1 + clamp01((gainDb - COMPRESSION_BOOST_GATE_DB) / COMPRESSION_BOOST_RANGE_DB);
    strength = Math.min(1, strength * boostFactor);
  }

  return strength;
}

/**
 * Effective per-track compression strength for playback and UI (0…1).
 * Uses manual override when set; otherwise {@link resolveAutoCompressionStrength}.
 */
export function getEffectiveCompressionStrength(track: Track, settings: LoudnessSettings): number {
  if (!settings.loudnessNormalizationEnabled || !settings.loudnessCompressionEnabled) {
    return 0;
  }

  const loudness = track.loudness;
  if (!loudness || loudness.status !== 'ok') {
    return 0;
  }

  if (loudness.manualCompressionStrength !== undefined) {
    return clamp01(loudness.manualCompressionStrength);
  }

  return resolveAutoCompressionStrength(track, settings);
}

/** @deprecated Prefer {@link getEffectiveCompressionStrength} — kept for existing imports. */
export const resolveCompressionStrength = getEffectiveCompressionStrength;
