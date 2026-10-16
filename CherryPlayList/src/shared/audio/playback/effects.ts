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

export const DEFAULT_TRACK_GAIN = 1;

export const MIN_TRACK_GAIN_DB = -30;
export const MAX_TRACK_GAIN_DB = 30;

export const TRACK_GAIN_LINEAR_MIN = 0;
export const TRACK_GAIN_LINEAR_MAX = 10 ** (MAX_TRACK_GAIN_DB / 20);

export const AUTO_GAIN_NORMALIZATION = 0.9;

export interface PlaybackEffects {
  setTrackGain(gain: number): void;

  setEqualizerBands(bands: EqualizerBands): void;

  setAutoGainEnabled(enabled: boolean): void;

  setCompressionStrength(strength: number): void;
}

export const isPlaybackEffects = (engine: unknown): engine is PlaybackEffects => {
  return (
    typeof engine === 'object' &&
    engine !== null &&
    'setTrackGain' in engine &&
    typeof (engine as PlaybackEffects).setTrackGain === 'function' &&
    'setCompressionStrength' in engine &&
    typeof (engine as PlaybackEffects).setCompressionStrength === 'function'
  );
};
