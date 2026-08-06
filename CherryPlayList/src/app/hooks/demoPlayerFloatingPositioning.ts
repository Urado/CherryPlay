import type {
  DemoPlayerFloatingPosition,
  DemoPlayerFloatingSize,
} from '@shared/stores/settingsStore';

export const PANEL_BOUNDS_PADDING_PX = 8;
export const DEFAULT_EDGE_OFFSET_PX = 16;
export const FALLBACK_PANEL_WIDTH_PX = 420;
/** Fixed floating panel height: header + track title row + single controls row. */
export const FLOATING_PANEL_FIXED_HEIGHT_PX = 120;
export const FALLBACK_PANEL_HEIGHT_PX = FLOATING_PANEL_FIXED_HEIGHT_PX;
export const FLOATING_PANEL_MIN_WIDTH_PX = 400;
export const FLOATING_PANEL_MIN_HEIGHT_PX = FLOATING_PANEL_FIXED_HEIGHT_PX;
export const FLOATING_PANEL_MAX_HEIGHT_PX = FLOATING_PANEL_FIXED_HEIGHT_PX;
export const KEYBOARD_DRAG_STEP_PX = 12;
export const KEYBOARD_DRAG_STEP_FAST_PX = 36;

export interface FloatingMetrics {
  panelWidth: number;
  panelHeight: number;
  containerWidth: number;
  containerHeight: number;
}

export function clampFloatingSize(
  width: number,
  _height: number,
  containerWidth: number,
  _containerHeight: number,
): DemoPlayerFloatingSize {
  const minWidth = FLOATING_PANEL_MIN_WIDTH_PX;
  const maxWidth = Math.max(minWidth, containerWidth - PANEL_BOUNDS_PADDING_PX * 2);

  return {
    width: Math.max(minWidth, Math.min(maxWidth, width)),
    height: FLOATING_PANEL_FIXED_HEIGHT_PX,
  };
}

export function clampFloatingPosition(
  x: number,
  y: number,
  metrics: FloatingMetrics,
  panelSize?: DemoPlayerFloatingSize,
): DemoPlayerFloatingPosition {
  const effectivePanelWidth = panelSize?.width ?? metrics.panelWidth;
  const effectivePanelHeight = FLOATING_PANEL_FIXED_HEIGHT_PX;
  const minX = PANEL_BOUNDS_PADDING_PX;
  const minY = PANEL_BOUNDS_PADDING_PX;
  const maxX = Math.max(
    minX,
    metrics.containerWidth - effectivePanelWidth - PANEL_BOUNDS_PADDING_PX,
  );
  const maxY = Math.max(
    minY,
    metrics.containerHeight - effectivePanelHeight - PANEL_BOUNDS_PADDING_PX,
  );

  return {
    x: Math.max(minX, Math.min(maxX, x)),
    y: Math.max(minY, Math.min(maxY, y)),
  };
}
