import type { DemoPlayerFloatingPosition } from '@shared/stores/settingsStore';

export const PANEL_BOUNDS_PADDING_PX = 8;
export const DEFAULT_EDGE_OFFSET_PX = 16;
export const FALLBACK_PANEL_WIDTH_PX = 320;
export const FALLBACK_PANEL_HEIGHT_PX = 120;
export const KEYBOARD_DRAG_STEP_PX = 12;
export const KEYBOARD_DRAG_STEP_FAST_PX = 36;

export interface FloatingMetrics {
  panelWidth: number;
  panelHeight: number;
  containerWidth: number;
  containerHeight: number;
}

export function clampFloatingPosition(
  x: number,
  y: number,
  metrics: FloatingMetrics,
): DemoPlayerFloatingPosition {
  const minX = PANEL_BOUNDS_PADDING_PX;
  const minY = PANEL_BOUNDS_PADDING_PX;
  const maxX = Math.max(
    minX,
    metrics.containerWidth - metrics.panelWidth - PANEL_BOUNDS_PADDING_PX,
  );
  const maxY = Math.max(
    minY,
    metrics.containerHeight - metrics.panelHeight - PANEL_BOUNDS_PADDING_PX,
  );

  return {
    x: Math.max(minX, Math.min(maxX, x)),
    y: Math.max(minY, Math.min(maxY, y)),
  };
}
