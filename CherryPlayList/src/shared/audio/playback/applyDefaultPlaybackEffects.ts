import { DEFAULT_EQUALIZER_BANDS, DEFAULT_TRACK_GAIN, isPlaybackEffects } from './effects';
import type { PlaybackEngine } from './PlaybackEngine';

/** Applies default track gain, EQ bands, and disables placeholder autogain after load. */
export function applyDefaultPlaybackEffects(engine: PlaybackEngine): void {
  if (!isPlaybackEffects(engine)) {
    return;
  }

  engine.setTrackGain(DEFAULT_TRACK_GAIN);
  engine.setEqualizerBands(DEFAULT_EQUALIZER_BANDS);
  engine.setAutoGainEnabled(false);
}
