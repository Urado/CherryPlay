import type React from 'react';

export const ANCHOR_PANEL_GAP_PX = 4;

export const ANCHOR_PANEL_Z_INDEX = 1001;

export const resolveAnchorPanelLeft = (
  anchorRect: DOMRect,
  panelWidth: number,
  gap = ANCHOR_PANEL_GAP_PX,
): number => {
  const rightSideLeft = anchorRect.right + gap;
  if (rightSideLeft + panelWidth <= window.innerWidth) {
    return rightSideLeft;
  }
  return anchorRect.left - panelWidth - gap;
};

export const resolveAnchorPanelCenterY = (anchorRect: DOMRect): number => {
  return anchorRect.top + anchorRect.height / 2;
};

type BuildAnchorPanelStyleOptions = {
  anchorRect: DOMRect;
  panelWidth: number;
  gap?: number;
};

export const buildAnchorPanelStyle = ({
  anchorRect,
  panelWidth,
  gap = ANCHOR_PANEL_GAP_PX,
}: BuildAnchorPanelStyleOptions): React.CSSProperties => {
  return {
    position: 'fixed',
    left: resolveAnchorPanelLeft(anchorRect, panelWidth, gap),
    top: resolveAnchorPanelCenterY(anchorRect),
    transform: 'translateY(-50%)',
    zIndex: ANCHOR_PANEL_Z_INDEX,
    width: panelWidth,
    boxSizing: 'border-box',
  };
};
