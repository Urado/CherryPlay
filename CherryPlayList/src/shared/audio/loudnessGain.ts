import type { Track } from '@core/types/track';

import type { LoudnessSettings } from '../contracts/loudness';

import { TRACK_GAIN_LINEAR_MAX, TRACK_GAIN_LINEAR_MIN } from './playback/effects';

export function getEffectiveGainDb(track: Track): number | undefined {
  const loudness = track.loudness;
  if (!loudness) {
    return undefined;
  }

  if (loudness.manualGainDb !== undefined) {
    return loudness.manualGainDb;
  }

  if (loudness.status === 'ok' && loudness.trackGainDb !== undefined) {
    return loudness.trackGainDb;
  }

  return undefined;
}

export function resolveLinearGain(track: Track, settings: LoudnessSettings): number {
  if (!settings.loudnessNormalizationEnabled) {
    return 1;
  }

  const gainDb = getEffectiveGainDb(track);
  if (gainDb === undefined) {
    return 1;
  }

  const linear = 10 ** (gainDb / 20);
  return Math.min(TRACK_GAIN_LINEAR_MAX, Math.max(TRACK_GAIN_LINEAR_MIN, linear));
}
