/**
 * Per-band equalizer settings in decibels.
 * Applied by {@link WebAudioPlaybackEngine} via BiquadFilter nodes.
 */
export interface EqualizerBands {
  readonly lowDb: number;
  readonly midDb: number;
  readonly highDb: number;
}

export const DEFAULT_EQUALIZER_BANDS: EqualizerBands = {
  lowDb: 0,
  midDb: 0,
  highDb: 0,
};

/** Linear track gain multiplier (1 = unity). Combined with auto-gain when enabled. */
export const DEFAULT_TRACK_GAIN = 1;

/** Placeholder auto-gain normalization factor when enabled (full analysis deferred). */
export const AUTO_GAIN_NORMALIZATION = 0.9;

/**
 * Optional effects capability for engines with a Web Audio gain/EQ chain.
 *
 * Playlist and session logic stay in stores; effects are playback-layer only.
 */
export interface PlaybackEffects {
  /** Per-track linear gain (0–2, 1 = unity). */
  setTrackGain(gain: number): void;

  /** Three-band EQ (low shelf, peaking mid, high shelf). */
  setEqualizerBands(bands: EqualizerBands): void;

  /**
   * Enables placeholder loudness normalization (fixed multiplier until real analysis).
   * @param enabled - When true, applies {@link AUTO_GAIN_NORMALIZATION} on top of track gain.
   */
  setAutoGainEnabled(enabled: boolean): void;
}

export function isPlaybackEffects(engine: unknown): engine is PlaybackEffects {
  return (
    typeof engine === 'object' &&
    engine !== null &&
    'setTrackGain' in engine &&
    typeof (engine as PlaybackEffects).setTrackGain === 'function'
  );
}
