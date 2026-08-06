export const TRACK_ITEM_SIZE_PRESETS = ['tiny', 'small', 'medium', 'large'] as const;

export type TrackItemSizePreset = (typeof TRACK_ITEM_SIZE_PRESETS)[number];

export function isTrackItemSizePreset(value: unknown): value is TrackItemSizePreset {
  return (
    typeof value === 'string' && (TRACK_ITEM_SIZE_PRESETS as readonly string[]).includes(value)
  );
}
