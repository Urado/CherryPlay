import { useCallback, useState } from 'react';
import type { PointerEvent } from 'react';

import {
  clampFloatingSize,
  FALLBACK_PANEL_WIDTH_PX,
  FLOATING_PANEL_FIXED_HEIGHT_PX,
  type FloatingMetrics,
} from '@app/hooks/demoPlayerFloatingPositioning';
import type { DemoPlayerFloatingSize } from '@shared/stores/settingsStore';

interface ResizeState {
  startX: number;
  originWidth: number;
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

      const metrics = measurePanelAndContainer();
      const originWidth = floatingSize?.width ?? metrics?.panelWidth ?? FALLBACK_PANEL_WIDTH_PX;

      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      setResizeState({
        startX: event.clientX,
        originWidth,
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
      const nextWidth = resizeState.originWidth + deltaX;
      const clampedSize = clampFloatingSize(
        nextWidth,
        FLOATING_PANEL_FIXED_HEIGHT_PX,
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
      const rawWidth = activeResizeState.originWidth + deltaX;

      if (!metrics) {
        commitFloatingSize({
          width: Math.max(1, rawWidth),
          height: FLOATING_PANEL_FIXED_HEIGHT_PX,
        });
        return;
      }

      commitFloatingSize(
        previewSize ??
          clampFloatingSize(
            rawWidth,
            FLOATING_PANEL_FIXED_HEIGHT_PX,
            metrics.containerWidth,
            metrics.containerHeight,
          ),
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
