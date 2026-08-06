import {
  isTrackItemSizePreset,
  TRACK_ITEM_SIZE_PRESETS,
} from '../../src/shared/types/trackItemSize';

describe('trackItemSize types', () => {
  it('TRACK_ITEM_SIZE_PRESETS includes tiny as first/smallest option', () => {
    expect(TRACK_ITEM_SIZE_PRESETS[0]).toBe('tiny');
    expect(TRACK_ITEM_SIZE_PRESETS).toEqual(['tiny', 'small', 'medium', 'large']);
  });

  it('isTrackItemSizePreset accepts all valid presets including tiny', () => {
    for (const preset of TRACK_ITEM_SIZE_PRESETS) {
      expect(isTrackItemSizePreset(preset)).toBe(true);
    }
  });

  it('isTrackItemSizePreset rejects invalid values', () => {
    expect(isTrackItemSizePreset(undefined)).toBe(false);
    expect(isTrackItemSizePreset(null)).toBe(false);
    expect(isTrackItemSizePreset('')).toBe(false);
    expect(isTrackItemSizePreset('xlarge')).toBe(false);
    expect(isTrackItemSizePreset('Крохотные')).toBe(false);
  });
});
