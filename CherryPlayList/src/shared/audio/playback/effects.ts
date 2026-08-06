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

/** Manual / playback track gain limits (dB), aligned with loudness UI slider. */
export const MIN_TRACK_GAIN_DB = -30;
export const MAX_TRACK_GAIN_DB = 30;

export const TRACK_GAIN_LINEAR_MIN = 0;
export const TRACK_GAIN_LINEAR_MAX = 10 ** (MAX_TRACK_GAIN_DB / 20);

/** Placeholder auto-gain normalization factor when enabled (full analysis deferred). */
export const AUTO_GAIN_NORMALIZATION = 0.9;

/**
 * Optional effects capability for engines with a Web Audio gain/EQ chain.
 *
 * Playlist and session logic stay in stores; effects are playback-layer only.
 */
export interface PlaybackEffects {
  /** Per-track linear gain (0…{@link TRACK_GAIN_LINEAR_MAX}, 1 = unity). */
  setTrackGain(gain: number): void;

  /** Three-band EQ (low shelf, peaking mid, high shelf). */
  setEqualizerBands(bands: EqualizerBands): void;

  /**
   * Enables placeholder loudness normalization (fixed multiplier until real analysis).
   * @param enabled - When true, applies {@link AUTO_GAIN_NORMALIZATION} on top of track gain.
   */
  setAutoGainEnabled(enabled: boolean): void;

  /**
   * Adaptive dynamics compression after EQ (loudness normalization feature).
   * @param strength - 0 = bypass; 0…1 maps to light…heavy compressor settings.
   */
  setCompressionStrength(strength: number): void;
}

export function isPlaybackEffects(engine: unknown): engine is PlaybackEffects {
  return (
    typeof engine === 'object' &&
    engine !== null &&
    'setTrackGain' in engine &&
    typeof (engine as PlaybackEffects).setTrackGain === 'function' &&
    'setCompressionStrength' in engine &&
    typeof (engine as PlaybackEffects).setCompressionStrength === 'function'
  );
}
