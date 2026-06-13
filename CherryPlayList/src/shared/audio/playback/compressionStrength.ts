import type { Track, TrackLoudness } from '@core/types/track';

import type { LoudnessSettings } from '../../contracts/loudness';
import { getEffectiveGainDb } from '../loudnessGain';

/** Fallback quiet-passage offset when only integrated LUFS is available. */
export const COMPRESSION_INTEGRATED_ONLY_QUIET_OFFSET_LU = 6;
/** Full strength when per-track gain deviates by this many dB from unity. */
export const COMPRESSION_GAIN_RANGE_DB = 12;
/** Full strength when quiet passages (LRA low) are this many LU below target. */
export const COMPRESSION_QUIET_GAP_RANGE_LU = 15;
/** Estimate quiet-passage loudness from LRA when {@link TrackLoudness.lraLowLufs} is missing. */
export const COMPRESSION_LRA_QUIET_ESTIMATE_FACTOR = 0.55;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
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
 * Auto-calculated compression strength in 0…1 from gain deviation and quiet-passage loudness.
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

  const gainDb = getEffectiveGainDb(track);
  if (gainDb === undefined) {
    return 0;
  }

  const gainFactor = clamp01(Math.abs(gainDb) / COMPRESSION_GAIN_RANGE_DB);

  const quietPassageLufs = resolveQuietPassageLufs(loudness);
  if (quietPassageLufs === undefined) {
    return 0;
  }

  const quietGapLu = settings.loudnessTargetLufs - quietPassageLufs;
  const quietFactor = clamp01(quietGapLu / COMPRESSION_QUIET_GAP_RANGE_LU);

  return gainFactor * quietFactor;
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
