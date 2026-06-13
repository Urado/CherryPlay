export const LOUDNESS_ALGORITHM_VERSION = 1 as const;

export const DEFAULT_LOUDNESS_TARGET_LUFS = -18;

/** @deprecated Use {@link DEFAULT_LOUDNESS_TARGET_LUFS}. */
export const DEFAULT_TARGET_LUFS = DEFAULT_LOUDNESS_TARGET_LUFS;

export const HEADROOM_DB_TP = -1;

export const MIN_TARGET_LUFS = -70;
export const MAX_TARGET_LUFS = 0;

export type LoudnessSettings = {
  loudnessNormalizationEnabled: boolean;
  loudnessTargetLufs: number;
  loudnessCompressionEnabled: boolean;
};

export type LoudnessAnalyzeOk = {
  status: 'ok';
  integratedLufs: number;
  lraLowLufs?: number;
  lraLu?: number;
  truePeakDb: number;
  trackGainDb: number;
  fileMtime: number;
  algorithmVersion: typeof LOUDNESS_ALGORITHM_VERSION;
};

export type LoudnessAnalyzeError = {
  status: 'error';
  errorMessage: string;
};

export type LoudnessAnalyzeResult = LoudnessAnalyzeOk | LoudnessAnalyzeError;

/** Alias for Electron scanner naming. */
export type LoudnessScanOk = LoudnessAnalyzeOk;
/** Alias for Electron scanner naming. */
export type LoudnessScanError = LoudnessAnalyzeError;
/** Alias for Electron scanner naming. */
export type LoudnessScanResult = LoudnessAnalyzeResult;
