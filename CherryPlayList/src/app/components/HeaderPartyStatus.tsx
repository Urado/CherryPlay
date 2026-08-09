import ArchiveOutlinedIcon from '@mui/icons-material/ArchiveOutlined';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CloudOffOutlinedIcon from '@mui/icons-material/CloudOffOutlined';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import {
  useLayoutStore,
  usePlayerAudioStore,
  useProjectStore,
  useSettingsStore,
} from '@shared/stores';

import { PartyGoToPlayGuidePanel } from '../../workspaces/party/PartyGoToPlayGuidePanel';
import {
  clearPartyHeaderGuideHighlight,
  findPartyHeaderGuideTarget,
  PARTY_HEADER_GUIDE_HIGHLIGHT_MS,
  PARTY_HEADER_GUIDE_TARGET_RESUME,
  type PartyHeaderGuideTargetKind,
  resolvePartyHeaderGuideStartLabel,
  resolvePartyHeaderGuideTargetKind,
  runPartyHeaderGuideHighlight,
  waitForPartyHeaderGuideTarget,
} from '../../workspaces/party/partyHeaderGoToPlayGuide';
import { usePartyWorkspaceStore } from '../../workspaces/party/partyWorkspaceStore';

import {
  HEADER_PARTY_CONTROL_STAGE_LABELS,
  type HeaderPartyControlStageLabel,
  resolveHeaderPartyControlActiveStageIndex,
  resolveHeaderPartyControlCtaLabel,
  resolveHeaderPartyStatusTooltip,
} from './headerPartyStatusVisuals';
import { isAlreadyOnOnlinePartyLayout, resolveHeaderPartyStatus } from './resolveHeaderPartyStatus';
import { LAYOUT_EDIT_DISABLED_TITLE } from './workspaceLayoutEditOptions';

const PLACEHOLDER_ACTION_TITLE = 'Скоро будет доступно';
const GO_TO_PLAY_CTA_TITLE = 'Показать, где начать проигрывание';

const STAGE_ICONS: Record<
  HeaderPartyControlStageLabel,
  React.ComponentType<{ fontSize?: 'inherit' | 'small' | 'medium' | 'large' }>
> = {
  'Не создана': CloudOffOutlinedIcon,
  'Ждёт начала': CheckCircleOutlineIcon,
  Идёт: PlayCircleOutlineIcon,
  'В архиве': ArchiveOutlinedIcon,
};

export interface HeaderPartyStatusProps {
  disabled?: boolean;
}

export const HeaderPartyStatus: React.FC<HeaderPartyStatusProps> = ({ disabled = false }) => {
  const linkedParty = useProjectStore((state) => state.meta.linkedParty);
  const sessionMode = useProjectStore((state) => state.sessionState.mode);
  const partyLifecycleState = usePartyWorkspaceStore((state) => state.partyLifecycleState);
  const serverUnreachable = usePartyWorkspaceStore((state) => state.serverUnreachable);
  const streamingSource = useSettingsStore((state) => state.streamingSource);
  const playbackStatus = usePlayerAudioStore((state) => state.status);
  const setLayoutPreset = useLayoutStore((state) => state.setLayoutPreset);

  const ctaRef = useRef<HTMLButtonElement>(null);
  const dismissTimerRef = useRef<number | null>(null);
  const waitAbortRef = useRef<AbortController | null>(null);
  const guideActiveRef = useRef(false);
  const targetKindRef = useRef<PartyHeaderGuideTargetKind>(PARTY_HEADER_GUIDE_TARGET_RESUME);
  const [guideOpen, setGuideOpen] = useState(false);
  const [guideAnchorRect, setGuideAnchorRect] = useState<DOMRect | null>(null);
  const [showGoButton, setShowGoButton] = useState(false);
  const [ctaEnabledSnapshot, setCtaEnabledSnapshot] = useState(false);

  const status = resolveHeaderPartyStatus({
    linkedParty,
    partyLifecycleState,
    sessionMode,
    serverUnreachable,
    playbackStatus: sessionMode === 'session' ? playbackStatus : null,
  });

  const activeStageIndex = resolveHeaderPartyControlActiveStageIndex(status.primary);
  const ctaLabel = resolveHeaderPartyControlCtaLabel(status.primary);
  const isGoToPlayCta = ctaLabel === 'К игре';
  const ctaEnabled = isGoToPlayCta && !disabled;
  const actionTitle = disabled
    ? LAYOUT_EDIT_DISABLED_TITLE
    : isGoToPlayCta
      ? GO_TO_PLAY_CTA_TITLE
      : PLACEHOLDER_ACTION_TITLE;

  const startLabel = resolvePartyHeaderGuideStartLabel(streamingSource);
  const targetKind = resolvePartyHeaderGuideTargetKind({
    primaryStatus: status.primary,
    streamingSource,
  });
  const panelStartLabel =
    targetKind === PARTY_HEADER_GUIDE_TARGET_RESUME ? 'Воспроизвести' : startLabel;
  const panelOpen = guideOpen && ctaEnabled && guideAnchorRect != null;

  if (ctaEnabled !== ctaEnabledSnapshot) {
    setCtaEnabledSnapshot(ctaEnabled);
    if (!ctaEnabled) {
      setGuideOpen(false);
      setGuideAnchorRect(null);
      setShowGoButton(false);
    }
  }

  const abortPendingWait = useCallback(() => {
    if (waitAbortRef.current) {
      waitAbortRef.current.abort();
      waitAbortRef.current = null;
    }
  }, []);

  const clearDismissTimer = useCallback(() => {
    if (dismissTimerRef.current != null) {
      window.clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
  }, []);

  const closeGuide = useCallback(() => {
    guideActiveRef.current = false;
    abortPendingWait();
    clearDismissTimer();
    clearPartyHeaderGuideHighlight();
    setGuideOpen(false);
    setGuideAnchorRect(null);
    setShowGoButton(false);
  }, [abortPendingWait, clearDismissTimer]);

  const scheduleGuideDismiss = useCallback(() => {
    clearDismissTimer();
    dismissTimerRef.current = window.setTimeout(() => {
      closeGuide();
    }, PARTY_HEADER_GUIDE_HIGHLIGHT_MS);
  }, [clearDismissTimer, closeGuide]);

  const openGuide = useCallback(() => {
    const rect = ctaRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }

    abortPendingWait();
    guideActiveRef.current = true;
    setGuideAnchorRect(rect);
    setGuideOpen(true);

    const target = findPartyHeaderGuideTarget(targetKindRef.current);
    setShowGoButton(!target);

    if (target) {
      runPartyHeaderGuideHighlight(target);
    } else {
      clearPartyHeaderGuideHighlight();
    }

    scheduleGuideDismiss();
  }, [abortPendingWait, scheduleGuideDismiss]);

  const handleCtaClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      if (!ctaEnabled) {
        return;
      }
      openGuide();
    },
    [ctaEnabled, openGuide],
  );

  const handleGo = useCallback(() => {
    const layoutState = useLayoutStore.getState();
    if (!isAlreadyOnOnlinePartyLayout(layoutState.activeWorkspace, layoutState.layout)) {
      setLayoutPreset('party');
    }

    abortPendingWait();
    const abortController = new AbortController();
    waitAbortRef.current = abortController;
    guideActiveRef.current = true;
    setShowGoButton(false);

    void waitForPartyHeaderGuideTarget(targetKindRef.current, {
      signal: abortController.signal,
    }).then((target) => {
      if (abortController.signal.aborted || !guideActiveRef.current) {
        return;
      }
      if (!target) {
        setShowGoButton(true);
        clearPartyHeaderGuideHighlight();
        scheduleGuideDismiss();
        return;
      }
      setShowGoButton(false);
      runPartyHeaderGuideHighlight(target);
      scheduleGuideDismiss();
    });
  }, [abortPendingWait, scheduleGuideDismiss, setLayoutPreset]);

  useLayoutEffect(() => {
    targetKindRef.current = targetKind;
  }, [targetKind]);

  useLayoutEffect(() => {
    if (ctaEnabled) {
      return;
    }
    guideActiveRef.current = false;
    abortPendingWait();
    clearDismissTimer();
    clearPartyHeaderGuideHighlight();
  }, [abortPendingWait, clearDismissTimer, ctaEnabled]);

  useEffect(() => {
    return () => {
      guideActiveRef.current = false;
      abortPendingWait();
      clearDismissTimer();
      clearPartyHeaderGuideHighlight();
    };
  }, [abortPendingWait, clearDismissTimer]);

  return (
    <div className="header-party-control" role="group" aria-label="Пульт вечеринки">
      <ol className="header-party-control__stages" aria-label="Этапы вечеринки">
        {HEADER_PARTY_CONTROL_STAGE_LABELS.map((label, index) => {
          const tooltip = resolveHeaderPartyStatusTooltip(label) ?? label;
          const isActive = index === activeStageIndex;
          const isPassed = index < activeStageIndex;
          const StageIcon = STAGE_ICONS[label];
          const showConnector = index < HEADER_PARTY_CONTROL_STAGE_LABELS.length - 1;
          const connectorFilled = index < activeStageIndex;

          return (
            <li
              key={label}
              className={[
                'header-party-control__stage',
                isActive ? 'header-party-control__stage--active' : '',
                isPassed ? 'header-party-control__stage--passed' : '',
                showConnector ? 'header-party-control__stage--with-connector' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <span
                className="header-party-control__stage-icon"
                title={tooltip}
                aria-label={`${label}${isActive ? ', текущий этап' : ''}`}
                role="img"
              >
                <StageIcon fontSize="inherit" />
              </span>
              {showConnector ? (
                <span
                  className={[
                    'header-party-control__stage-connector',
                    connectorFilled ? 'header-party-control__stage-connector--filled' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  aria-hidden
                />
              ) : null}
            </li>
          );
        })}
      </ol>

      <div className="header-party-control__main">
        <div className="header-party-control__status" role="status">
          <span
            className="header-party-control__status-primary"
            title={resolveHeaderPartyStatusTooltip(status.primary) ?? undefined}
          >
            {status.primary}
          </span>
          {status.secondary ? (
            <span
              className="header-party-control__status-secondary"
              title={resolveHeaderPartyStatusTooltip(status.secondary) ?? undefined}
            >
              {status.secondary}
            </span>
          ) : null}
        </div>

        <span className="header-party-control__action-arrow" aria-hidden>
          <ArrowForwardIcon fontSize="inherit" />
        </span>

        <button
          ref={ctaRef}
          type="button"
          className="header-button header-party-control__cta"
          disabled={!ctaEnabled}
          title={actionTitle}
          aria-label={`${ctaLabel}. ${actionTitle}`}
          aria-expanded={panelOpen}
          aria-haspopup="dialog"
          onClick={handleCtaClick}
        >
          <span className="header-party-control__cta-label">{ctaLabel}</span>
        </button>
      </div>

      {panelOpen && guideAnchorRect ? (
        <PartyGoToPlayGuidePanel
          anchorRect={guideAnchorRect}
          showGoButton={showGoButton}
          startLabel={panelStartLabel}
          excludeCloseRef={ctaRef}
          onGo={handleGo}
          onClose={closeGuide}
        />
      ) : null}
    </div>
  );
};
