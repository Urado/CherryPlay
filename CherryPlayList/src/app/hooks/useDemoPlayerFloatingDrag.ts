import { useCallback, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';

import {
  clampFloatingPosition,
  DEFAULT_EDGE_OFFSET_PX,
  KEYBOARD_DRAG_STEP_FAST_PX,
  KEYBOARD_DRAG_STEP_PX,
  type FloatingMetrics,
} from '@app/hooks/demoPlayerFloatingPositioning';
import type { DemoPlayerFloatingPosition } from '@shared/stores/settingsStore';

interface UseDemoPlayerFloatingDragParams {
  isLayoutBlocked: boolean;
  resolvedFloatingPosition: DemoPlayerFloatingPosition | null;
  measurePanelAndContainer: () => FloatingMetrics | null;
  commitFloatingPosition: (position: DemoPlayerFloatingPosition) => void;
}

interface DragState {
  startX: number;
  startY: number;
  originX: number;
  originY: number;
}

export interface DemoPlayerFloatingDragApi {
  dragPosition: DemoPlayerFloatingPosition | null;
  handleGripPointerDown: (event: PointerEvent<HTMLElement>) => void;
  handleGripPointerMove: (event: PointerEvent<HTMLElement>) => void;
  finishGripPointer: (event: PointerEvent<HTMLElement>) => void;
  handleGripKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
}

function shouldIgnoreDragStart(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false;
  }

  if (target.closest('.demo-player-panel__grip')) {
    return false;
  }

  return Boolean(
    target.closest('button, input, select, textarea, [role="button"], [data-no-drag="true"]'),
  );
}

function getKeyboardDelta(key: string, step: number): DemoPlayerFloatingPosition | null {
  switch (key) {
    case 'ArrowLeft':
      return { x: -step, y: 0 };
    case 'ArrowRight':
      return { x: step, y: 0 };
    case 'ArrowUp':
      return { x: 0, y: -step };
    case 'ArrowDown':
      return { x: 0, y: step };
    default:
      return null;
  }
}

export function useDemoPlayerFloatingDrag({
  isLayoutBlocked,
  resolvedFloatingPosition,
  measurePanelAndContainer,
  commitFloatingPosition,
}: UseDemoPlayerFloatingDragParams): DemoPlayerFloatingDragApi {
  const [dragPosition, setDragPosition] = useState<DemoPlayerFloatingPosition | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);

  const handleGripPointerDown = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      if (isLayoutBlocked || event.button !== 0) {
        return;
      }
      if (shouldIgnoreDragStart(event.target)) {
        return;
      }

      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);

      const origin = resolvedFloatingPosition ?? {
        x: DEFAULT_EDGE_OFFSET_PX,
        y: DEFAULT_EDGE_OFFSET_PX,
      };
      setDragState({
        startX: event.clientX,
        startY: event.clientY,
        originX: origin.x,
        originY: origin.y,
      });
    },
    [isLayoutBlocked, resolvedFloatingPosition],
  );

  const handleGripPointerMove = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      if (!dragState) {
        return;
      }

      const metrics = measurePanelAndContainer();
      if (!metrics) {
        return;
      }

      setDragPosition(
        clampFloatingPosition(
          dragState.originX + (event.clientX - dragState.startX),
          dragState.originY + (event.clientY - dragState.startY),
          metrics,
        ),
      );
    },
    [dragState, measurePanelAndContainer],
  );

  const finishGripPointer = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      const activeDragState = dragState;
      setDragState(null);

      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }

      setDragPosition(null);

      if (!activeDragState) {
        return;
      }

      const metrics = measurePanelAndContainer();
      if (!metrics) {
        commitFloatingPosition({
          x: activeDragState.originX + (event.clientX - activeDragState.startX),
          y: activeDragState.originY + (event.clientY - activeDragState.startY),
        });
        return;
      }

      commitFloatingPosition(
        clampFloatingPosition(
          activeDragState.originX + (event.clientX - activeDragState.startX),
          activeDragState.originY + (event.clientY - activeDragState.startY),
          metrics,
        ),
      );
    },
    [commitFloatingPosition, dragState, measurePanelAndContainer],
  );

  const handleGripKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (isLayoutBlocked) {
        return;
      }

      const step = event.shiftKey ? KEYBOARD_DRAG_STEP_FAST_PX : KEYBOARD_DRAG_STEP_PX;
      const delta = getKeyboardDelta(event.key, step);
      if (!delta) {
        return;
      }

      event.preventDefault();

      const origin = dragPosition ??
        resolvedFloatingPosition ?? {
          x: DEFAULT_EDGE_OFFSET_PX,
          y: DEFAULT_EDGE_OFFSET_PX,
        };
      const metrics = measurePanelAndContainer();
      if (!metrics) {
        commitFloatingPosition({
          x: origin.x + delta.x,
          y: origin.y + delta.y,
        });
        return;
      }

      const nextPosition = clampFloatingPosition(origin.x + delta.x, origin.y + delta.y, metrics);
      setDragPosition(nextPosition);
      commitFloatingPosition(nextPosition);
    },
    [
      commitFloatingPosition,
      dragPosition,
      isLayoutBlocked,
      measurePanelAndContainer,
      resolvedFloatingPosition,
    ],
  );

  return {
    dragPosition,
    handleGripPointerDown,
    handleGripPointerMove,
    finishGripPointer,
    handleGripKeyDown,
  };
}
