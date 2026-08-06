/** Same tolerance as {@link TrackLoudnessPopover} gain commit — values within this are treated as auto. */
export const GAIN_AUTO_MATCH_TOLERANCE_DB = 0.05;

/** Same tolerance as compression commit in popover. */
export const COMPRESSION_AUTO_MATCH_TOLERANCE = 0.005;

export function isGainOverridden(
  effectiveGainDb: number | undefined,
  autoGainDb: number | undefined,
): boolean {
  if (autoGainDb === undefined || effectiveGainDb === undefined) {
    return false;
  }
  return Math.abs(effectiveGainDb - autoGainDb) >= GAIN_AUTO_MATCH_TOLERANCE_DB;
}

export function isCompressionOverridden(effectiveStrength: number, autoStrength: number): boolean {
  return Math.abs(effectiveStrength - autoStrength) >= COMPRESSION_AUTO_MATCH_TOLERANCE;
}
