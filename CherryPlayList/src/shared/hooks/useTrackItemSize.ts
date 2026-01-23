import { useEffect } from 'react';

import { useSettingsStore } from '../stores/settingsStore';

const SIZE_PRESETS = {
  small: { padding: 8, margin: 2 },
  medium: { padding: 12, margin: 4 },
  large: { padding: 16, margin: 6 },
} as const;

/**
 * Hook to initialize and update CSS variables for track item sizes
 * based on the selected preset from settings
 */
export function useTrackItemSize(): void {
  const trackItemSizePreset = useSettingsStore((state) => state.trackItemSizePreset);

  useEffect(() => {
    const preset = SIZE_PRESETS[trackItemSizePreset];
    document.documentElement.style.setProperty('--track-item-padding', `${preset.padding}px`);
    document.documentElement.style.setProperty('--track-item-margin', `${preset.margin}px`);
  }, [trackItemSizePreset]);
}
