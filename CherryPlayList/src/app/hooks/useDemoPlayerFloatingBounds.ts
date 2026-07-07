import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

import {
  clampFloatingPosition,
  DEFAULT_EDGE_OFFSET_PX,
  FALLBACK_PANEL_HEIGHT_PX,
  FALLBACK_PANEL_WIDTH_PX,
  PANEL_BOUNDS_PADDING_PX,
  type FloatingMetrics,
} from '@app/hooks/demoPlayerFloatingPositioning';
import type { DemoPlayerFloatingPosition } from '@shared/stores/settingsStore';

interface UseDemoPlayerFloatingBoundsParams {
  contentContainerRef: RefObject<HTMLElement | null>;
  demoPlayerFloatingPosition: DemoPlayerFloatingPosition | null;
  setDemoPlayerFloatingPosition: (position: DemoPlayerFloatingPosition) => void;
}

export interface DemoPlayerFloatingBoundsApi {
  panelRef: RefObject<HTMLDivElement | null>;
  measurePanelAndContainer: () => FloatingMetrics | null;
  commitFloatingPosition: (position: DemoPlayerFloatingPosition) => void;
}

function positionsEqual(a: DemoPlayerFloatingPosition, b: DemoPlayerFloatingPosition): boolean {
  return a.x === b.x && a.y === b.y;
}

function getDefaultFloatingPosition(metrics: FloatingMetrics): DemoPlayerFloatingPosition {
  const x = Math.max(
    PANEL_BOUNDS_PADDING_PX,
    metrics.containerWidth - metrics.panelWidth - DEFAULT_EDGE_OFFSET_PX,
  );
  const y = DEFAULT_EDGE_OFFSET_PX;
  return clampFloatingPosition(x, y, metrics);
}

export function useDemoPlayerFloatingBounds({
  contentContainerRef,
  demoPlayerFloatingPosition,
  setDemoPlayerFloatingPosition,
}: UseDemoPlayerFloatingBoundsParams): DemoPlayerFloatingBoundsApi {
  const panelRef = useRef<HTMLDivElement>(null);
  const pendingFloatingPositionRef = useRef<DemoPlayerFloatingPosition | null>(null);
  const storedPositionRef = useRef(demoPlayerFloatingPosition);
  const [resizeTick, setResizeTick] = useState(0);

  useEffect(() => {
    storedPositionRef.current = demoPlayerFloatingPosition;
  }, [demoPlayerFloatingPosition]);

  const measurePanelAndContainer = useCallback((): FloatingMetrics | null => {
    const panel = panelRef.current;
    const container = contentContainerRef.current;
    if (!panel || !container) {
      return null;
    }

    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    if (containerWidth <= 0 || containerHeight <= 0) {
      return null;
    }

    return {
      panelWidth: panel.offsetWidth > 0 ? panel.offsetWidth : FALLBACK_PANEL_WIDTH_PX,
      panelHeight: panel.offsetHeight > 0 ? panel.offsetHeight : FALLBACK_PANEL_HEIGHT_PX,
      containerWidth,
      containerHeight,
    };
  }, [contentContainerRef]);

  const commitFloatingPosition = useCallback(
    (position: DemoPlayerFloatingPosition) => {
      const metrics = measurePanelAndContainer();
      if (!metrics) {
        pendingFloatingPositionRef.current = position;
        return;
      }

      pendingFloatingPositionRef.current = null;
      const clamped = clampFloatingPosition(position.x, position.y, metrics);
      const current = storedPositionRef.current;
      if (current && positionsEqual(current, clamped)) {
        return;
      }
      setDemoPlayerFloatingPosition(clamped);
    },
    [measurePanelAndContainer, setDemoPlayerFloatingPosition],
  );

  useEffect(() => {
    const container = contentContainerRef.current;
    const panel = panelRef.current;
    if (!container || !panel) {
      return;
    }

    const emitResizeTick = () => {
      setResizeTick((prev) => prev + 1);
    };

    const resizeObserver = new ResizeObserver(emitResizeTick);
    resizeObserver.observe(container);
    resizeObserver.observe(panel);
    window.addEventListener('resize', emitResizeTick);
    emitResizeTick();

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', emitResizeTick);
    };
  }, [contentContainerRef]);

  useEffect(() => {
    if (resizeTick === 0) {
      return;
    }

    const metrics = measurePanelAndContainer();
    if (!metrics) {
      return;
    }

    if (demoPlayerFloatingPosition === null) {
      setDemoPlayerFloatingPosition(getDefaultFloatingPosition(metrics));
      return;
    }

    const source = pendingFloatingPositionRef.current ?? storedPositionRef.current;
    if (!source) {
      return;
    }

    const clamped = clampFloatingPosition(source.x, source.y, metrics);

    const hadPending = pendingFloatingPositionRef.current !== null;
    pendingFloatingPositionRef.current = null;

    const current = storedPositionRef.current;
    if (!current) {
      return;
    }

    if (hadPending || !positionsEqual(current, clamped)) {
      setDemoPlayerFloatingPosition(clamped);
    }
  }, [
    demoPlayerFloatingPosition,
    measurePanelAndContainer,
    resizeTick,
    setDemoPlayerFloatingPosition,
  ]);

  return {
    panelRef,
    measurePanelAndContainer,
    commitFloatingPosition,
  };
}
