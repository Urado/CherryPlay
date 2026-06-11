export const clampPlaybackValue = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));
