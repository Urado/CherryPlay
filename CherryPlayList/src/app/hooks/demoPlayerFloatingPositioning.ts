import type {
  DemoPlayerFloatingPosition,
  DemoPlayerFloatingSize,
} from '@shared/stores/settingsStore';

export const PANEL_BOUNDS_PADDING_PX = 8;
export const DEFAULT_EDGE_OFFSET_PX = 16;
export const FALLBACK_PANEL_WIDTH_PX = 320;
export const FALLBACK_PANEL_HEIGHT_PX = 120;
export const FLOATING_PANEL_MIN_WIDTH_PX = 280;
export const FLOATING_PANEL_MIN_HEIGHT_PX = 112;
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
  height: number,
  containerWidth: number,
  containerHeight: number,
): DemoPlayerFloatingSize {
  const minWidth = FLOATING_PANEL_MIN_WIDTH_PX;
  const minHeight = FLOATING_PANEL_MIN_HEIGHT_PX;
  const maxWidth = Math.max(minWidth, containerWidth - PANEL_BOUNDS_PADDING_PX * 2);
  const maxHeight = Math.max(minHeight, containerHeight - PANEL_BOUNDS_PADDING_PX * 2);

  return {
    width: Math.max(minWidth, Math.min(maxWidth, width)),
    height: Math.max(minHeight, Math.min(maxHeight, height)),
  };
}

export function clampFloatingPosition(
  x: number,
  y: number,
  metrics: FloatingMetrics,
  panelSize?: DemoPlayerFloatingSize,
): DemoPlayerFloatingPosition {
  const effectivePanelWidth = panelSize?.width ?? metrics.panelWidth;
  const effectivePanelHeight = panelSize?.height ?? metrics.panelHeight;
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
