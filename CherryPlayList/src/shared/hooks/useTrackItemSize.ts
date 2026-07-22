import { useEffect } from 'react';

import { useSettingsStore } from '../stores/settingsStore';
import { isTrackItemSizePreset, type TrackItemSizePreset } from '../types/trackItemSize';

const DEFAULT_PRESET: TrackItemSizePreset = 'medium';

const SIZE_PRESETS: Record<TrackItemSizePreset, { padding: number; margin: number }> = {
  tiny: { padding: 1, margin: 0 },
  small: { padding: 5, margin: 1 },
  medium: { padding: 8, margin: 2 },
  large: { padding: 12, margin: 4 },
};

/**
 * Hook to initialize and update CSS variables for track item sizes
 * based on the selected preset from settings
 */
export function useTrackItemSize(): void {
  const trackItemSizePreset = useSettingsStore((state) => state.trackItemSizePreset);

  useEffect(() => {
    const resolvedPreset = isTrackItemSizePreset(trackItemSizePreset)
      ? trackItemSizePreset
      : DEFAULT_PRESET;
    const preset = SIZE_PRESETS[resolvedPreset];
    document.documentElement.style.setProperty('--track-item-padding', `${preset.padding}px`);
    document.documentElement.style.setProperty('--track-item-margin', `${preset.margin}px`);
    document.documentElement.setAttribute('data-track-item-size', resolvedPreset);
  }, [trackItemSizePreset]);
}
