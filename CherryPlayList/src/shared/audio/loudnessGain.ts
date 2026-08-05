import type { Track, TrackLoudness } from '@core/types/track';

import { computeAutoGainDb, type LoudnessSettings } from '../contracts/loudness';

import { TRACK_GAIN_LINEAR_MAX, TRACK_GAIN_LINEAR_MIN } from './playback/effects';

export { computeAutoGainDb } from '../contracts/loudness';

/** Auto gain from scan metadata and the current target LUFS (ignores persisted trackGainDb). */
export function resolveAutoGainDb(
  loudness: TrackLoudness | undefined,
  targetLufs: number,
): number | undefined {
  if (!loudness || loudness.status !== 'ok') {
    return undefined;
  }

  if (loudness.integratedLufs === undefined || loudness.truePeakDb === undefined) {
    return undefined;
  }

  return computeAutoGainDb(loudness.integratedLufs, loudness.truePeakDb, targetLufs);
}

export function getEffectiveGainDb(track: Track, settings: LoudnessSettings): number | undefined {
  const loudness = track.loudness;
  if (!loudness) {
    return undefined;
  }

  if (loudness.manualGainDb !== undefined) {
    return loudness.manualGainDb;
  }

  if (loudness.status === 'ok') {
    return resolveAutoGainDb(loudness, settings.loudnessTargetLufs);
  }

  return undefined;
}

export function resolveLinearGain(track: Track, settings: LoudnessSettings): number {
  if (!settings.loudnessNormalizationEnabled) {
    return 1;
  }

  const gainDb = getEffectiveGainDb(track, settings);
  if (gainDb === undefined) {
    return 1;
  }

  const linear = 10 ** (gainDb / 20);
  return Math.min(TRACK_GAIN_LINEAR_MAX, Math.max(TRACK_GAIN_LINEAR_MIN, linear));
}
