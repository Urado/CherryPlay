import { useCallback, useState } from 'react';
import type { PointerEvent } from 'react';

import {
  clampFloatingSize,
  FALLBACK_PANEL_HEIGHT_PX,
  FALLBACK_PANEL_WIDTH_PX,
  type FloatingMetrics,
} from '@app/hooks/demoPlayerFloatingPositioning';
import type { DemoPlayerFloatingSize } from '@shared/stores/settingsStore';

type ResizeAxis = 'east' | 'south' | 'southeast';

interface ResizeState {
  axis: ResizeAxis;
  startX: number;
  startY: number;
  originWidth: number;
  originHeight: number;
}

interface UseDemoPlayerFloatingResizeParams {
  isLayoutBlocked: boolean;
  floatingSize: DemoPlayerFloatingSize | null;
  measurePanelAndContainer: () => FloatingMetrics | null;
  commitFloatingSize: (size: DemoPlayerFloatingSize) => void;
}

export interface DemoPlayerFloatingResizeApi {
  resizeSize: DemoPlayerFloatingSize | null;
  handleResizePointerDown: (event: PointerEvent<HTMLDivElement>) => void;
  handleResizePointerMove: (event: PointerEvent<HTMLDivElement>) => void;
  finishResizePointer: (event: PointerEvent<HTMLDivElement>) => void;
}

function resolveAxis(value: string | null): ResizeAxis {
  if (value === 'east' || value === 'south') {
    return value;
  }
  return 'southeast';
}

export function useDemoPlayerFloatingResize({
  isLayoutBlocked,
  floatingSize,
  measurePanelAndContainer,
  commitFloatingSize,
}: UseDemoPlayerFloatingResizeParams): DemoPlayerFloatingResizeApi {
  const [resizeState, setResizeState] = useState<ResizeState | null>(null);
  const [resizeSize, setResizeSize] = useState<DemoPlayerFloatingSize | null>(null);

  const handleResizePointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (isLayoutBlocked || event.button !== 0) {
        return;
      }

      const axis = resolveAxis(event.currentTarget.dataset.resizeAxis ?? null);
      const metrics = measurePanelAndContainer();
      const originWidth = floatingSize?.width ?? metrics?.panelWidth ?? FALLBACK_PANEL_WIDTH_PX;
      const originHeight = floatingSize?.height ?? metrics?.panelHeight ?? FALLBACK_PANEL_HEIGHT_PX;

      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      setResizeState({
        axis,
        startX: event.clientX,
        startY: event.clientY,
        originWidth,
        originHeight,
      });
    },
    [floatingSize, isLayoutBlocked, measurePanelAndContainer],
  );

  const handleResizePointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (!resizeState) {
        return;
      }

      const metrics = measurePanelAndContainer();
      if (!metrics) {
        return;
      }

      const deltaX = event.clientX - resizeState.startX;
      const deltaY = event.clientY - resizeState.startY;
      const nextWidth =
        resizeState.axis === 'south' ? resizeState.originWidth : resizeState.originWidth + deltaX;
      const nextHeight =
        resizeState.axis === 'east' ? resizeState.originHeight : resizeState.originHeight + deltaY;
      const clampedSize = clampFloatingSize(
        nextWidth,
        nextHeight,
        metrics.containerWidth,
        metrics.containerHeight,
      );
      setResizeSize(clampedSize);
    },
    [measurePanelAndContainer, resizeState],
  );

  const finishResizePointer = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const activeResizeState = resizeState;
      setResizeState(null);
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }

      const previewSize = resizeSize;
      setResizeSize(null);

      if (!activeResizeState) {
        return;
      }

      const metrics = measurePanelAndContainer();
      const deltaX = event.clientX - activeResizeState.startX;
      const deltaY = event.clientY - activeResizeState.startY;
      const rawWidth =
        activeResizeState.axis === 'south'
          ? activeResizeState.originWidth
          : activeResizeState.originWidth + deltaX;
      const rawHeight =
        activeResizeState.axis === 'east'
          ? activeResizeState.originHeight
          : activeResizeState.originHeight + deltaY;

      if (!metrics) {
        commitFloatingSize({
          width: Math.max(1, rawWidth),
          height: Math.max(1, rawHeight),
        });
        return;
      }

      commitFloatingSize(
        previewSize ??
          clampFloatingSize(rawWidth, rawHeight, metrics.containerWidth, metrics.containerHeight),
      );
    },
    [commitFloatingSize, measurePanelAndContainer, resizeSize, resizeState],
  );

  return {
    resizeSize,
    handleResizePointerDown,
    handleResizePointerMove,
    finishResizePointer,
  };
}
