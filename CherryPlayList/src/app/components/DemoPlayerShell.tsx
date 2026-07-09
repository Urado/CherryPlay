import CloseIcon from '@mui/icons-material/Close';
import DragHandleIcon from '@mui/icons-material/DragHandle';
import React, { useCallback, useEffect, useMemo } from 'react';

import {
  useDemoPlayerFloatingBounds,
  useDemoPlayerFloatingDrag,
  useDemoPlayerFloatingResize,
  useDemoPlayerFloatingVisibility,
} from '@app/hooks';
import { DemoPlayer } from '@shared/components';
import { useLayoutStore, useSettingsStore, useUIStore } from '@shared/stores';
import { useDemoPlayerStore } from '@shared/stores/demoPlayerStore';
import { collectWorkspaceTypes } from '@shared/utils/layoutWorkspaceOperations';

export interface DemoPlayerShellProps {
  /** `.app-content` element used for floating bounds and default position. */
  contentContainerRef: React.RefObject<HTMLElement | null>;
}

export const DemoPlayerShell: React.FC<DemoPlayerShellProps> = ({ contentContainerRef }) => {
  const demoPlayerFloatingPosition = useSettingsStore((state) => state.demoPlayerFloatingPosition);
  const demoPlayerFloatingSize = useSettingsStore((state) => state.demoPlayerFloatingSize);
  const demoPlayerFloatingOpen = useSettingsStore((state) => state.demoPlayerFloatingOpen);
  const setDemoPlayerFloatingPosition = useSettingsStore(
    (state) => state.setDemoPlayerFloatingPosition,
  );
  const setDemoPlayerFloatingSize = useSettingsStore((state) => state.setDemoPlayerFloatingSize);
  const setDemoPlayerFloatingOpen = useSettingsStore((state) => state.setDemoPlayerFloatingOpen);
  const isLayoutEditMode = useLayoutStore((state) => state.isLayoutEditMode);
  const layout = useLayoutStore((state) => state.layout);
  const focusFileInBrowser = useUIStore((state) => state.focusFileInBrowser);
  const clearDemoPlayer = useDemoPlayerStore((state) => state.clear);
  const currentTrack = useDemoPlayerStore((state) => state.currentTrack);
  const demoPlayerStatus = useDemoPlayerStore((state) => state.status);

  const isLayoutBlocked = isLayoutEditMode;
  const hasDemoPlayerWorkspace = useMemo(
    () => collectWorkspaceTypes(layout.rootZone).has('demo-player'),
    [layout],
  );

  const { isFloatingVisible } = useDemoPlayerFloatingVisibility({
    hasDemoPlayerWorkspace,
    demoPlayerFloatingOpen,
    currentTrack,
    demoPlayerStatus,
    setDemoPlayerFloatingOpen,
  });

  const { panelRef, measurePanelAndContainer, commitFloatingPosition, commitFloatingSize } =
    useDemoPlayerFloatingBounds({
      contentContainerRef,
      demoPlayerFloatingPosition,
      demoPlayerFloatingSize,
      setDemoPlayerFloatingPosition,
      setDemoPlayerFloatingSize,
    });

  const {
    dragPosition,
    handleGripPointerDown,
    handleGripPointerMove,
    finishGripPointer,
    handleGripKeyDown,
  } = useDemoPlayerFloatingDrag({
    isLayoutBlocked,
    resolvedFloatingPosition: demoPlayerFloatingPosition,
    measurePanelAndContainer,
    commitFloatingPosition,
  });

  const { resizeSize, handleResizePointerDown, handleResizePointerMove, finishResizePointer } =
    useDemoPlayerFloatingResize({
      isLayoutBlocked,
      floatingSize: demoPlayerFloatingSize,
      measurePanelAndContainer,
      commitFloatingSize,
    });

  useEffect(() => {
    return () => {
      clearDemoPlayer();
    };
  }, [clearDemoPlayer]);

  const resolvedFloatingPosition = dragPosition ?? demoPlayerFloatingPosition;
  const resolvedFloatingSize = resizeSize ?? demoPlayerFloatingSize;

  const shellClassName = useMemo(
    () =>
      [
        'demo-player-panel',
        'demo-player-panel--floating',
        isLayoutBlocked ? 'demo-player-panel--layout-blocked' : null,
      ]
        .filter(Boolean)
        .join(' '),
    [isLayoutBlocked],
  );

  const handleCloseFloatingPanel = useCallback(() => {
    setDemoPlayerFloatingOpen(false);
    clearDemoPlayer();
  }, [clearDemoPlayer, setDemoPlayerFloatingOpen]);

  const panelStyle = useMemo((): React.CSSProperties => {
    if (!isFloatingVisible || !resolvedFloatingPosition) {
      return {
        position: 'absolute',
        visibility: 'hidden',
        pointerEvents: 'none',
      };
    }

    return {
      position: 'absolute',
      left: resolvedFloatingPosition.x,
      top: resolvedFloatingPosition.y,
      visibility: 'visible',
      width: resolvedFloatingSize?.width,
      height: resolvedFloatingSize?.height,
    };
  }, [isFloatingVisible, resolvedFloatingPosition, resolvedFloatingSize]);

  return (
    <div ref={panelRef} className={shellClassName} data-placement="floating" style={panelStyle}>
      <div
        className="demo-player-panel__header"
        onPointerDown={handleGripPointerDown}
        onPointerMove={handleGripPointerMove}
        onPointerUp={finishGripPointer}
        onPointerCancel={finishGripPointer}
      >
        <button
          type="button"
          className="demo-player-panel__grip"
          aria-label="Перетащить панель прослушивания"
          title="Перетащить панель (стрелки; Shift+стрелки — большой шаг)"
          onKeyDown={handleGripKeyDown}
          disabled={isLayoutBlocked}
        >
          <DragHandleIcon fontSize="small" aria-hidden />
        </button>
        <span className="demo-player-panel__title">Прослушивание</span>
        <button
          type="button"
          className="demo-player-panel__close"
          aria-label="Закрыть окно прослушивания"
          title="Закрыть панель и остановить прослушивание"
          onClick={handleCloseFloatingPanel}
          disabled={isLayoutBlocked}
        >
          <CloseIcon fontSize="small" aria-hidden />
        </button>
      </div>
      <div className="demo-player-panel__player" inert={isLayoutBlocked || undefined}>
        <DemoPlayer
          onShowInBrowser={focusFileInBrowser}
          clearOnUnmount={false}
          interactionBlocked={isLayoutBlocked}
        />
      </div>
      <div
        className="demo-player-panel__resize-handle demo-player-panel__resize-handle--east"
        data-resize-axis="east"
        onPointerDown={handleResizePointerDown}
        onPointerMove={handleResizePointerMove}
        onPointerUp={finishResizePointer}
        onPointerCancel={finishResizePointer}
        aria-hidden
      />
      <div
        className="demo-player-panel__resize-handle demo-player-panel__resize-handle--south"
        data-resize-axis="south"
        onPointerDown={handleResizePointerDown}
        onPointerMove={handleResizePointerMove}
        onPointerUp={finishResizePointer}
        onPointerCancel={finishResizePointer}
        aria-hidden
      />
      <div
        className="demo-player-panel__resize-handle demo-player-panel__resize-handle--southeast"
        data-resize-axis="southeast"
        onPointerDown={handleResizePointerDown}
        onPointerMove={handleResizePointerMove}
        onPointerUp={finishResizePointer}
        onPointerCancel={finishResizePointer}
        aria-hidden
      />
    </div>
  );
};
