import type React from 'react';

/** Gap between a track-row anchor control and its anchored panel. */
export const ANCHOR_PANEL_GAP_PX = 4;

/** Shared z-index for track-row anchored panels (dropdowns, popovers). */
export const ANCHOR_PANEL_Z_INDEX = 1001;

export function resolveAnchorPanelLeft(
  anchorRect: DOMRect,
  panelWidth: number,
  gap = ANCHOR_PANEL_GAP_PX,
): number {
  const rightSideLeft = anchorRect.right + gap;
  if (rightSideLeft + panelWidth <= window.innerWidth) {
    return rightSideLeft;
  }
  return anchorRect.left - panelWidth - gap;
}

export function resolveAnchorPanelCenterY(anchorRect: DOMRect): number {
  return anchorRect.top + anchorRect.height / 2;
}

type BuildAnchorPanelStyleOptions = {
  anchorRect: DOMRect;
  panelWidth: number;
  gap?: number;
};

/** Fixed-width panel anchored to a track-row control, vertically centered on the anchor. */
export function buildAnchorPanelStyle({
  anchorRect,
  panelWidth,
  gap = ANCHOR_PANEL_GAP_PX,
}: BuildAnchorPanelStyleOptions): React.CSSProperties {
  return {
    position: 'fixed',
    left: resolveAnchorPanelLeft(anchorRect, panelWidth, gap),
    top: resolveAnchorPanelCenterY(anchorRect),
    transform: 'translateY(-50%)',
    zIndex: ANCHOR_PANEL_Z_INDEX,
    width: panelWidth,
    boxSizing: 'border-box',
  };
}
