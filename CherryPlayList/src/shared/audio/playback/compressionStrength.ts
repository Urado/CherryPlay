import type { Track, TrackLoudness } from '@core/types/track';

import {
  clampLoudnessQuietGapRangeLu,
  COMPRESSION_QUIET_GAP_RANGE_LU,
  DEFAULT_LOUDNESS_QUIET_GAP_RANGE_LU,
  type LoudnessSettings,
} from '../../contracts/loudness';
import { getEffectiveGainDb } from '../loudnessGain';

export const COMPRESSION_INTEGRATED_ONLY_QUIET_OFFSET_LU = 6;
export { COMPRESSION_QUIET_GAP_RANGE_LU };
export const COMPRESSION_LRA_QUIET_ESTIMATE_FACTOR = 0.55;
export const COMPRESSION_LRA_MIN_LU = 8;
export const COMPRESSION_LRA_RANGE_LU = 10;
export const COMPRESSION_BOOST_GATE_DB = 3;
export const COMPRESSION_BOOST_RANGE_DB = 12;

const clamp01 = (value: number): number => {
  return Math.min(1, Math.max(0, value));
};

export const resolveQuietGapRangeLu = (settings: LoudnessSettings): number => {
  return clampLoudnessQuietGapRangeLu(
    settings.loudnessQuietGapRangeLu ?? DEFAULT_LOUDNESS_QUIET_GAP_RANGE_LU,
  );
};

export const resolveQuietPassageLufs = (loudness: TrackLoudness): number | undefined => {
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
};

export const resolveDynamicNeed = (loudness: TrackLoudness): number => {
  if (loudness.lraLu !== undefined) {
    return clamp01((loudness.lraLu - COMPRESSION_LRA_MIN_LU) / COMPRESSION_LRA_RANGE_LU);
  }

  if (loudness.integratedLufs !== undefined && loudness.lraLowLufs !== undefined) {
    const spreadLu = loudness.integratedLufs - loudness.lraLowLufs;
    return clamp01((spreadLu - COMPRESSION_LRA_MIN_LU) / COMPRESSION_LRA_RANGE_LU);
  }

  return 1;
};

export const resolveAutoCompressionStrength = (
  track: Track,
  settings: LoudnessSettings,
): number => {
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
};

export const getEffectiveCompressionStrength = (
  track: Track,
  settings: LoudnessSettings,
): number => {
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
};

export const resolveCompressionStrength = getEffectiveCompressionStrength;
