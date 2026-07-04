import { type PartyThemeId } from '@cherryplay/components';
import DragHandleIcon from '@mui/icons-material/DragHandle';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { PartyPreviewScenarioControls } from './components/PartyPreviewScenarioControls';
import type { PartyPreviewScenarioPlaybackContext } from './components/PartyPreviewScenarioControls';
import type { PartyEditorBlockedReason } from './partyEditorPhase';
import { syncPreviewWithProduction } from './partyPreviewScenarioActions';
import {
  demoResetToDefault,
  demoSetBlockedOverride,
  demoSetLinkedLifecycle,
  demoSetPartyNotFound,
  demoSetUnlinkedDraft,
} from './partyWorkspaceDemoActions';

import './PartyWorkspaceDemoPanel.css';

export type PartyWorkspaceDemoPanelMode = 'editor' | 'preview';

const PANEL_HEIGHT_PERCENT: Record<PartyWorkspaceDemoPanelMode, number> = {
  preview: 0.22,
  editor: 0.28,
};

const PANEL_MIN_HEIGHT_PX = 100;
const PANEL_MAX_HEIGHT_RATIO = 0.7;
const PANEL_DRAG_CLICK_THRESHOLD_PX = 4;

interface PartyWorkspaceDemoPanelProps {
  mode: PartyWorkspaceDemoPanelMode;
  previewTrackIds?: readonly string[];
  playbackContext?: PartyPreviewScenarioPlaybackContext;
  previewThemeId?: PartyThemeId;
  previewDesignOptions?: Array<{ id: PartyThemeId; name: string; isAvailable: boolean }>;
  previewCustomizationSettings?: Record<string, unknown>;
  /** When false, hides demo-only reset in preview mode (production Electron). */
  showDemoReset?: boolean;
}

const BLOCKED_SCENARIOS: {
  label: string;
  reason: PartyEditorBlockedReason;
  onClick?: () => void;
}[] = [
  { label: 'Нет авторизации', reason: 'auth' },
  { label: 'Устаревший клиент', reason: 'outdated' },
  { label: 'Загрузка', reason: 'checking' },
  { label: 'Сервер недоступен', reason: 'unreachable' },
  { label: 'Вечеринка удалена', reason: 'party-not-found', onClick: demoSetPartyNotFound },
];

export const PartyWorkspaceDemoPanel: React.FC<PartyWorkspaceDemoPanelProps> = ({
  mode,
  previewTrackIds = [],
  playbackContext = {
    isSynchronized: true,
    previewLifecycleState: null,
    effectivePlaybackState: null,
  },
  previewThemeId = 'cyberpunk',
  previewDesignOptions = [],
  previewCustomizationSettings = {},
  showDemoReset = true,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(mode === 'preview');
  const [panelHeightPx, setPanelHeightPx] = useState<number | null>(null);
  const panelRef = useRef<HTMLElement>(null);
  const dragStateRef = useRef<{ startY: number; startHeight: number; moved: boolean } | null>(null);

  const getParentHeight = useCallback(() => panelRef.current?.parentElement?.clientHeight ?? 0, []);

  const getDefaultHeight = useCallback(() => {
    const parentHeight = getParentHeight();
    return parentHeight > 0 ? Math.round(parentHeight * PANEL_HEIGHT_PERCENT[mode]) : null;
  }, [getParentHeight, mode]);

  const clampPanelHeight = useCallback(
    (height: number) => {
      const parentHeight = getParentHeight();
      const minHeight = PANEL_MIN_HEIGHT_PX;
      const maxHeight =
        parentHeight > 0 ? Math.round(parentHeight * PANEL_MAX_HEIGHT_RATIO) : height;
      return Math.max(minHeight, Math.min(maxHeight, height));
    },
    [getParentHeight],
  );

  const getExpandedHeight = useCallback(() => {
    const measuredDefault = getDefaultHeight();
    const fallbackHeight = measuredDefault ?? PANEL_MIN_HEIGHT_PX;
    return panelHeightPx ?? fallbackHeight;
  }, [getDefaultHeight, panelHeightPx]);

  useEffect(() => {
    const handleResize = () => {
      setPanelHeightPx((currentHeight) => {
        if (currentHeight == null) {
          return currentHeight;
        }
        return clampPanelHeight(currentHeight);
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [clampPanelHeight]);

  const toggleCollapsed = useCallback(() => {
    setIsCollapsed((collapsed) => {
      if (collapsed) {
        setPanelHeightPx((currentHeight) => currentHeight ?? getDefaultHeight());
      }
      return !collapsed;
    });
  }, [getDefaultHeight]);

  const handleCollapsedGripClick = () => {
    toggleCollapsed();
  };

  const handleExpandedGripPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStateRef.current = {
      startY: event.clientY,
      startHeight: getExpandedHeight(),
      moved: false,
    };
  };

  const handleExpandedGripPointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const dragState = dragStateRef.current;
    if (!dragState) {
      return;
    }

    const deltaY = dragState.startY - event.clientY;
    if (Math.abs(deltaY) < PANEL_DRAG_CLICK_THRESHOLD_PX) {
      return;
    }

    dragState.moved = true;
    setPanelHeightPx(clampPanelHeight(dragState.startHeight + deltaY));
  };

  const finishExpandedGripPointer = (event: React.PointerEvent<HTMLButtonElement>) => {
    const dragState = dragStateRef.current;
    dragStateRef.current = null;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (dragState && !dragState.moved) {
      toggleCollapsed();
    }
  };

  const gripLabel = isCollapsed
    ? mode === 'preview'
      ? 'Развернуть сценарии превью'
      : 'Развернуть демо-панель'
    : mode === 'preview'
      ? 'Свернуть сценарии превью'
      : 'Свернуть демо-панель';

  return (
    <aside
      ref={panelRef}
      className={`party-workspace-demo-panel${
        mode === 'preview' ? ' party-workspace-demo-panel--preview' : ''
      }${isCollapsed ? ' party-workspace-demo-panel--collapsed' : ''}${
        !isCollapsed && panelHeightPx != null ? ' party-workspace-demo-panel--sized' : ''
      }`}
      style={!isCollapsed && panelHeightPx != null ? { height: panelHeightPx } : undefined}
      aria-label="Демо-сценарии вечеринки"
    >
      <button
        type="button"
        className={`party-workspace-demo-panel-grip${
          isCollapsed
            ? ' party-workspace-demo-panel-grip--collapsed'
            : ' party-workspace-demo-panel-grip--expanded'
        }`}
        onClick={isCollapsed ? handleCollapsedGripClick : undefined}
        onPointerDown={isCollapsed ? undefined : handleExpandedGripPointerDown}
        onPointerMove={isCollapsed ? undefined : handleExpandedGripPointerMove}
        onPointerUp={isCollapsed ? undefined : finishExpandedGripPointer}
        onPointerCancel={isCollapsed ? undefined : finishExpandedGripPointer}
        aria-expanded={!isCollapsed}
        aria-label={gripLabel}
        title={
          isCollapsed
            ? 'Развернуть панель сценариев'
            : 'Потяните для изменения высоты, клик — свернуть'
        }
      >
        <DragHandleIcon className="party-workspace-demo-panel-grip-icon" aria-hidden />
      </button>
      <div className="party-workspace-demo-panel-header">
        <span className="party-workspace-demo-panel-badge">
          {mode === 'preview' ? 'Сценарии' : 'Демо'}
        </span>
        <span className="party-workspace-demo-panel-title">
          {mode === 'editor' ? 'Сценарии редактора' : 'Сценарии превью'}
        </span>
      </div>

      <div className="party-workspace-demo-panel-body">
        {mode === 'editor' && (
          <>
            <div className="party-workspace-demo-panel-group">
              <span className="party-workspace-demo-panel-group-label">Фазы редактора</span>
              <div className="party-workspace-demo-panel-buttons">
                <button
                  type="button"
                  className="party-workspace-demo-panel-button"
                  onClick={demoSetUnlinkedDraft}
                >
                  Создание (без подключения)
                </button>
                <button
                  type="button"
                  className="party-workspace-demo-panel-button"
                  onClick={() => demoSetLinkedLifecycle('draft')}
                >
                  Не на сайте (подключена)
                </button>
                <button
                  type="button"
                  className="party-workspace-demo-panel-button"
                  onClick={() => demoSetLinkedLifecycle('ready')}
                >
                  Опубликована
                </button>
                <button
                  type="button"
                  className="party-workspace-demo-panel-button"
                  onClick={() => demoSetLinkedLifecycle('completed')}
                >
                  Архив
                </button>
              </div>
            </div>

            <div className="party-workspace-demo-panel-group">
              <span className="party-workspace-demo-panel-group-label">Блокирующие оверлеи</span>
              <div className="party-workspace-demo-panel-buttons">
                {BLOCKED_SCENARIOS.map(({ label, reason, onClick }) => (
                  <button
                    key={reason}
                    type="button"
                    className="party-workspace-demo-panel-button party-workspace-demo-panel-button--blocked"
                    onClick={onClick ?? (() => demoSetBlockedOverride(reason))}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="party-workspace-demo-panel-group">
              <button
                type="button"
                className="party-workspace-demo-panel-button party-workspace-demo-panel-button--reset"
                onClick={syncPreviewWithProduction}
              >
                Синхронизировать превью с эфиром
              </button>
            </div>

            <div className="party-workspace-demo-panel-group">
              <button
                type="button"
                className="party-workspace-demo-panel-button party-workspace-demo-panel-button--reset"
                onClick={demoResetToDefault}
              >
                Сброс демо
              </button>
            </div>
          </>
        )}

        {mode === 'preview' && (
          <>
            <PartyPreviewScenarioControls
              variant="panel"
              previewTrackIds={previewTrackIds}
              playbackContext={playbackContext}
              previewThemeId={previewThemeId}
              previewCustomizationSettings={previewCustomizationSettings}
              previewDesignOptions={previewDesignOptions}
            />

            {showDemoReset && (
              <div className="party-workspace-demo-panel-group">
                <button
                  type="button"
                  className="party-workspace-demo-panel-button party-workspace-demo-panel-button--reset"
                  onClick={demoResetToDefault}
                >
                  Сброс демо
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  );
};
