import { useEffect } from 'react';

import { type TrackItemSizePreset, useSettingsStore } from '../stores/settingsStore';

export type { TrackItemSizePreset };

const SIZE_PRESETS: Record<
  TrackItemSizePreset,
  { padding: number; margin: number; minHeight: number; controlSize: number }
> = {
  // Effective row ≈ controlSize + padding*2; minHeight floors the layout.
  xsmall: { padding: 4, margin: 0, minHeight: 32, controlSize: 24 },
  small: { padding: 8, margin: 2, minHeight: 40, controlSize: 28 },
  medium: { padding: 12, margin: 4, minHeight: 48, controlSize: 32 },
  large: { padding: 16, margin: 6, minHeight: 56, controlSize: 36 },
};

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
    document.documentElement.style.setProperty('--track-item-min-height', `${preset.minHeight}px`);
    document.documentElement.style.setProperty(
      '--track-item-control-size',
      `${preset.controlSize}px`,
    );
  }, [trackItemSizePreset]);
}
