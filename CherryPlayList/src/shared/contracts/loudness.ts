export const LOUDNESS_ALGORITHM_VERSION = 1 as const;

export const DEFAULT_LOUDNESS_TARGET_LUFS = -18;

/** @deprecated Use {@link DEFAULT_LOUDNESS_TARGET_LUFS}. */
export const DEFAULT_TARGET_LUFS = DEFAULT_LOUDNESS_TARGET_LUFS;

export const HEADROOM_DB_TP = -1;

export const MIN_TARGET_LUFS = -70;
export const MAX_TARGET_LUFS = 0;

/** Min/max for global quiet-passage gap threshold (LU) in settings slider. */
export const MIN_LOUDNESS_QUIET_GAP_RANGE_LU = 5;
export const MAX_LOUDNESS_QUIET_GAP_RANGE_LU = 30;
export const DEFAULT_LOUDNESS_QUIET_GAP_RANGE_LU = 15;

/** Full strength at default quiet-gap threshold (legacy constant). */
export const COMPRESSION_QUIET_GAP_RANGE_LU = DEFAULT_LOUDNESS_QUIET_GAP_RANGE_LU;

export type LoudnessQuietGapPresetId = 'quiet' | 'normal' | 'reference';

export const LOUDNESS_QUIET_GAP_PRESETS: ReadonlyArray<{
  id: LoudnessQuietGapPresetId;
  value: number;
  label: string;
}> = [
  { id: 'quiet', value: 10, label: 'Тихая комната' },
  { id: 'normal', value: 15, label: 'Обычное' },
  { id: 'reference', value: 22, label: 'Студия' },
];

/** @deprecated Migrated to {@link LoudnessSettings.loudnessQuietGapRangeLu}. */
export type LoudnessListeningEnvironment = LoudnessQuietGapPresetId;

/** @deprecated Use {@link DEFAULT_LOUDNESS_QUIET_GAP_RANGE_LU}. */
export const DEFAULT_LOUDNESS_LISTENING_ENVIRONMENT: LoudnessListeningEnvironment = 'normal';

/** @deprecated Use {@link LOUDNESS_QUIET_GAP_PRESETS}. */
export const LOUDNESS_LISTENING_ENVIRONMENT_QUIET_GAP_LU: Record<
  LoudnessListeningEnvironment,
  number
> = {
  reference: 22,
  normal: 15,
  quiet: 10,
};

export function clampLoudnessQuietGapRangeLu(value: number): number {
  return Math.min(
    MAX_LOUDNESS_QUIET_GAP_RANGE_LU,
    Math.max(MIN_LOUDNESS_QUIET_GAP_RANGE_LU, value),
  );
}

/** Min/max for global loudness target slider in settings. */
export function clampLoudnessTargetLufs(value: number): number {
  return Math.min(MAX_TARGET_LUFS, Math.max(MIN_TARGET_LUFS, value));
}

/** Per-track auto gain in dB with −1 dBTP headroom cap (scan + playback + UI). */
export function computeAutoGainDb(
  integratedLufs: number,
  truePeakDb: number,
  targetLufs: number,
  headroomDbTp: number = HEADROOM_DB_TP,
): number {
  const lufsGainDb = targetLufs - integratedLufs;
  const headroomCapDb = headroomDbTp - truePeakDb;
  return Math.min(lufsGainDb, headroomCapDb);
}

export function resolveQuietGapRangePercent(value: number): number {
  const clamped = clampLoudnessQuietGapRangeLu(value);
  return (
    ((clamped - MIN_LOUDNESS_QUIET_GAP_RANGE_LU) /
      (MAX_LOUDNESS_QUIET_GAP_RANGE_LU - MIN_LOUDNESS_QUIET_GAP_RANGE_LU)) *
    100
  );
}

export type LoudnessSettings = {
  loudnessNormalizationEnabled: boolean;
  loudnessTargetLufs: number;
  loudnessCompressionEnabled: boolean;
  loudnessQuietGapRangeLu: number;
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
