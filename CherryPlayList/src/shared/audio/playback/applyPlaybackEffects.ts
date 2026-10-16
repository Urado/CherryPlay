import type { Track } from '@core/types/track';

import {
  DEFAULT_LOUDNESS_QUIET_GAP_RANGE_LU,
  DEFAULT_LOUDNESS_TARGET_LUFS,
  type LoudnessSettings,
} from '../../contracts/loudness';
import { resolveLinearGain } from '../loudnessGain';

import { getEffectiveCompressionStrength } from './compressionStrength';
import { DEFAULT_EQUALIZER_BANDS, DEFAULT_TRACK_GAIN, isPlaybackEffects } from './effects';
import type { PlaybackEngine } from './PlaybackEngine';

export const applyLoudnessPlaybackEffects = (
  engine: PlaybackEngine,
  track: Track,
  settings: LoudnessSettings,
): void => {
  if (!isPlaybackEffects(engine)) {
    return;
  }

  if (settings.loudnessNormalizationEnabled) {
    engine.setTrackGain(resolveLinearGain(track, settings));
    engine.setAutoGainEnabled(false);
    engine.setCompressionStrength(getEffectiveCompressionStrength(track, settings));
  } else {
    engine.setTrackGain(DEFAULT_TRACK_GAIN);
    engine.setAutoGainEnabled(false);
    engine.setCompressionStrength(0);
  }
};

export const applyPlaybackEffects = (
  engine: PlaybackEngine,
  track: Track,
  settings: LoudnessSettings,
): void => {
  applyLoudnessPlaybackEffects(engine, track, settings);

  if (isPlaybackEffects(engine)) {
    engine.setEqualizerBands(DEFAULT_EQUALIZER_BANDS);
  }
};

export const applyDefaultPlaybackEffects = (engine: PlaybackEngine): void => {
  applyPlaybackEffects(
    engine,
    { id: '', path: '', name: '' },
    {
      loudnessNormalizationEnabled: false,
      loudnessTargetLufs: DEFAULT_LOUDNESS_TARGET_LUFS,
      loudnessCompressionEnabled: false,
      loudnessQuietGapRangeLu: DEFAULT_LOUDNESS_QUIET_GAP_RANGE_LU,
    },
  );
};
