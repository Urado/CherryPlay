import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

import {
  clampFloatingSize,
  clampFloatingPosition,
  DEFAULT_EDGE_OFFSET_PX,
  FALLBACK_PANEL_HEIGHT_PX,
  FALLBACK_PANEL_WIDTH_PX,
  PANEL_BOUNDS_PADDING_PX,
  type FloatingMetrics,
} from '@app/hooks/demoPlayerFloatingPositioning';
import type {
  DemoPlayerFloatingPosition,
  DemoPlayerFloatingSize,
} from '@shared/stores/settingsStore';

interface UseDemoPlayerFloatingBoundsParams {
  contentContainerRef: RefObject<HTMLElement | null>;
  demoPlayerFloatingPosition: DemoPlayerFloatingPosition | null;
  demoPlayerFloatingSize: DemoPlayerFloatingSize | null;
  setDemoPlayerFloatingPosition: (position: DemoPlayerFloatingPosition) => void;
  setDemoPlayerFloatingSize: (size: DemoPlayerFloatingSize) => void;
}

export interface DemoPlayerFloatingBoundsApi {
  panelRef: RefObject<HTMLDivElement | null>;
  measurePanelAndContainer: () => FloatingMetrics | null;
  commitFloatingPosition: (position: DemoPlayerFloatingPosition) => void;
  commitFloatingSize: (size: DemoPlayerFloatingSize) => void;
}

function positionsEqual(a: DemoPlayerFloatingPosition, b: DemoPlayerFloatingPosition): boolean {
  return a.x === b.x && a.y === b.y;
}

function sizesEqual(a: DemoPlayerFloatingSize, b: DemoPlayerFloatingSize): boolean {
  return a.width === b.width && a.height === b.height;
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
  demoPlayerFloatingSize,
  setDemoPlayerFloatingPosition,
  setDemoPlayerFloatingSize,
}: UseDemoPlayerFloatingBoundsParams): DemoPlayerFloatingBoundsApi {
  const panelRef = useRef<HTMLDivElement>(null);
  const pendingFloatingPositionRef = useRef<DemoPlayerFloatingPosition | null>(null);
  const pendingFloatingSizeRef = useRef<DemoPlayerFloatingSize | null>(null);
  const storedPositionRef = useRef(demoPlayerFloatingPosition);
  const storedSizeRef = useRef(demoPlayerFloatingSize);
  const [resizeTick, setResizeTick] = useState(0);

  useEffect(() => {
    storedPositionRef.current = demoPlayerFloatingPosition;
  }, [demoPlayerFloatingPosition]);

  useEffect(() => {
    storedSizeRef.current = demoPlayerFloatingSize;
  }, [demoPlayerFloatingSize]);

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
      const clamped = clampFloatingPosition(
        position.x,
        position.y,
        metrics,
        storedSizeRef.current ?? undefined,
      );
      const current = storedPositionRef.current;
      if (current && positionsEqual(current, clamped)) {
        return;
      }
      setDemoPlayerFloatingPosition(clamped);
    },
    [measurePanelAndContainer, setDemoPlayerFloatingPosition],
  );

  const commitFloatingSize = useCallback(
    (size: DemoPlayerFloatingSize) => {
      const metrics = measurePanelAndContainer();
      if (!metrics) {
        pendingFloatingSizeRef.current = size;
        return;
      }

      pendingFloatingSizeRef.current = null;
      const clampedSize = clampFloatingSize(
        size.width,
        size.height,
        metrics.containerWidth,
        metrics.containerHeight,
      );

      const currentSize = storedSizeRef.current;
      if (!currentSize || !sizesEqual(currentSize, clampedSize)) {
        setDemoPlayerFloatingSize(clampedSize);
      }

      const sourcePosition = pendingFloatingPositionRef.current ?? storedPositionRef.current;
      if (!sourcePosition) {
        return;
      }

      const clampedPosition = clampFloatingPosition(
        sourcePosition.x,
        sourcePosition.y,
        metrics,
        clampedSize,
      );
      const currentPosition = storedPositionRef.current;
      if (!currentPosition || !positionsEqual(currentPosition, clampedPosition)) {
        setDemoPlayerFloatingPosition(clampedPosition);
      }
    },
    [measurePanelAndContainer, setDemoPlayerFloatingPosition, setDemoPlayerFloatingSize],
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

    const sourceSize = pendingFloatingSizeRef.current ?? storedSizeRef.current;
    if (sourceSize) {
      const clampedSize = clampFloatingSize(
        sourceSize.width,
        sourceSize.height,
        metrics.containerWidth,
        metrics.containerHeight,
      );
      const hadPendingSize = pendingFloatingSizeRef.current !== null;
      pendingFloatingSizeRef.current = null;
      const currentSize = storedSizeRef.current;
      if (!currentSize || hadPendingSize || !sizesEqual(currentSize, clampedSize)) {
        setDemoPlayerFloatingSize(clampedSize);
      }
    }

    if (demoPlayerFloatingPosition === null) {
      const clampedPosition = clampFloatingPosition(
        getDefaultFloatingPosition(metrics).x,
        getDefaultFloatingPosition(metrics).y,
        metrics,
        storedSizeRef.current ?? undefined,
      );
      setDemoPlayerFloatingPosition(clampedPosition);
      return;
    }

    const source = pendingFloatingPositionRef.current ?? storedPositionRef.current;
    if (!source) {
      return;
    }

    const clamped = clampFloatingPosition(
      source.x,
      source.y,
      metrics,
      storedSizeRef.current ?? undefined,
    );

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
    setDemoPlayerFloatingSize,
  ]);

  return {
    panelRef,
    measurePanelAndContainer,
    commitFloatingPosition,
    commitFloatingSize,
  };
}
