import ArchiveOutlinedIcon from '@mui/icons-material/ArchiveOutlined';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CloudOffOutlinedIcon from '@mui/icons-material/CloudOffOutlined';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import {
  useAuthStore,
  useLayoutStore,
  usePlayerAudioStore,
  useProjectStore,
  useSettingsStore,
  useUIStore,
  openPartySettingsModal,
} from '@shared/stores';
import { useOnlineNetworkPolicy } from '@shared/streaming';

import { PartyGoToPlayGuidePanel } from '../../workspaces/party/PartyGoToPlayGuidePanel';
import {
  publishPartyFromHeader,
  unarchivePartyFromHeader,
} from '../../workspaces/party/partyHeaderCommands';
import {
  clearPartyHeaderGuideHighlight,
  findPartyHeaderGuideTarget,
  PARTY_HEADER_GUIDE_HIGHLIGHT_MS,
  PARTY_HEADER_GUIDE_TARGET_RESUME,
  PARTY_HEADER_GUIDE_TARGET_STOP,
  type PartyHeaderGuideTargetKind,
  resolvePartyHeaderGuideStartLabel,
  resolvePartyHeaderGuideStopLabel,
  resolvePartyHeaderGuideTargetKind,
  runPartyHeaderGuideHighlight,
  waitForPartyHeaderGuideTarget,
} from '../../workspaces/party/partyHeaderGoToPlayGuide';
import { PartyProgramEndedReminder } from '../../workspaces/party/PartyProgramEndedReminder';
import { usePartyProgramEndedStore } from '../../workspaces/party/partyProgramEndedStore';
import { usePartyWorkspaceStore } from '../../workspaces/party/partyWorkspaceStore';
import { resolveHeaderPartyPublishDisabledReason } from '../../workspaces/party/resolveHeaderPartyPublishDisabledReason';
import { usePartyPublishOutOfSync } from '../../workspaces/party/usePartyPublishOutOfSync';

import {
  HEADER_PARTY_CONTROL_STAGE_LABELS,
  type HeaderPartyControlStageLabel,
  resolveHeaderPartyControlActiveStageIndex,
  resolveHeaderPartyControlCtaLabel,
  resolveHeaderPartyStatusTooltip,
} from './headerPartyStatusVisuals';
import { isAlreadyOnOnlinePartyLayout, resolveHeaderPartyStatus } from './resolveHeaderPartyStatus';
import { LAYOUT_EDIT_DISABLED_TITLE } from './workspaceLayoutEditOptions';

const GO_TO_PLAY_CTA_TITLE = 'Показать, где начать проигрывание';
const GO_TO_STOP_CTA_TITLE = 'Показать, где остановить проигрывание';
const OPEN_SETTINGS_CTA_TITLE = 'Открыть настройки вечеринки';
const UNARCHIVE_CTA_TITLE = 'Вернуть вечеринку из архива';
const SETTINGS_BUTTON_TITLE = 'Настройки вечеринки';
const SETTINGS_BUTTON_ARIA_LABEL = 'Открыть настройки вечеринки';

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
  const isPublishing = usePartyWorkspaceStore((state) => state.isPublishing);
  const isTransitioningLifecycle = usePartyWorkspaceStore(
    (state) => state.isTransitioningLifecycle,
  );
  const streamingSource = useSettingsStore((state) => state.streamingSource);
  const playbackStatus = usePlayerAudioStore((state) => state.status);
  const programEnded = usePartyProgramEndedStore((state) => state.programEnded);
  const setLayoutPreset = useLayoutStore((state) => state.setLayoutPreset);
  const isAuthenticated = useAuthStore(
    (state) => state.accessToken !== null && state.organizer !== null,
  );
  const { networkEnabled } = useOnlineNetworkPolicy();
  const hasLinkedParty = Boolean(linkedParty);
  const publishOutOfSync = usePartyPublishOutOfSync(hasLinkedParty);

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
    programEnded: sessionMode === 'session' && programEnded,
  });

  const activeStageIndex = resolveHeaderPartyControlActiveStageIndex(status.primary);
  const ctaLabel = resolveHeaderPartyControlCtaLabel(status.primary);
  const isGoToPlayCta = ctaLabel === 'Играть';
  const isGoToStopCta = ctaLabel === 'Остановить';
  const isOpenAboutCta = ctaLabel === 'Создать' || ctaLabel === 'К настройкам';
  const isUnarchiveCta = ctaLabel === 'Вернуть из архива';
  const ctaEnabled =
    !disabled && (isGoToPlayCta || isGoToStopCta || isOpenAboutCta || isUnarchiveCta);
  const actionTitle = disabled
    ? LAYOUT_EDIT_DISABLED_TITLE
    : isGoToPlayCta
      ? GO_TO_PLAY_CTA_TITLE
      : isGoToStopCta
        ? GO_TO_STOP_CTA_TITLE
        : isOpenAboutCta
          ? OPEN_SETTINGS_CTA_TITLE
          : isUnarchiveCta
            ? UNARCHIVE_CTA_TITLE
            : OPEN_SETTINGS_CTA_TITLE;

  const startLabel = resolvePartyHeaderGuideStartLabel(streamingSource);
  const stopLabel = resolvePartyHeaderGuideStopLabel(streamingSource);
  const targetKind = resolvePartyHeaderGuideTargetKind({
    primaryStatus: status.primary,
    streamingSource,
  });
  const panelStartLabel =
    targetKind === PARTY_HEADER_GUIDE_TARGET_STOP
      ? stopLabel
      : targetKind === PARTY_HEADER_GUIDE_TARGET_RESUME
        ? 'Воспроизвести'
        : startLabel;
  const usesGuidePanel = isGoToPlayCta || isGoToStopCta;
  const panelOpen = guideOpen && usesGuidePanel && ctaEnabled && guideAnchorRect != null;

  const publishDisabledReason = resolveHeaderPartyPublishDisabledReason({
    isAuthenticated,
    networkEnabled,
    hasLinkedParty,
    partyLifecycleState,
  });
  const publishBusy = isPublishing;
  const publishBlockedByLayout = disabled;
  const publishDisabled = publishBlockedByLayout || publishBusy || publishDisabledReason != null;
  const publishTitle = publishBusy
    ? 'Обновление на сайте…'
    : publishBlockedByLayout
      ? LAYOUT_EDIT_DISABLED_TITLE
      : (publishDisabledReason ?? 'Обновить плейлист и настройки, которые видят гости');

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

  const pauseGuideDismiss = useCallback(() => {
    clearDismissTimer();
  }, [clearDismissTimer]);

  const resumeGuideDismiss = useCallback(() => {
    if (!guideActiveRef.current) {
      return;
    }
    scheduleGuideDismiss();
  }, [scheduleGuideDismiss]);

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

  const openPartySettings = useCallback(() => {
    openPartySettingsModal();
  }, []);

  const handleCtaClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      if (!ctaEnabled) {
        return;
      }
      if (isOpenAboutCta) {
        openPartySettings();
        return;
      }
      if (isUnarchiveCta) {
        void unarchivePartyFromHeader();
        return;
      }
      openGuide();
    },
    [ctaEnabled, isOpenAboutCta, isUnarchiveCta, openGuide, openPartySettings],
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

  const handlePublishClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      if (publishBlockedByLayout || publishBusy) {
        return;
      }
      if (publishDisabledReason) {
        useUIStore.getState().addNotification({
          type: 'warning',
          message: publishDisabledReason,
        });
        if (!isAuthenticated) {
          useUIStore.getState().openModal('account');
        }
        return;
      }
      void publishPartyFromHeader();
    },
    [isAuthenticated, publishBlockedByLayout, publishBusy, publishDisabledReason],
  );

  const handleSettingsClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      if (disabled) {
        return;
      }
      openPartySettings();
    },
    [disabled, openPartySettings],
  );

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

        <div className="header-party-control__actions">
          <button
            ref={ctaRef}
            type="button"
            className="header-button header-party-control__cta"
            disabled={!ctaEnabled || (isUnarchiveCta && isTransitioningLifecycle)}
            title={actionTitle}
            aria-label={`${ctaLabel}. ${actionTitle}`}
            aria-expanded={panelOpen}
            aria-haspopup={usesGuidePanel ? 'dialog' : undefined}
            onClick={handleCtaClick}
          >
            <span className="header-party-control__cta-label">{ctaLabel}</span>
          </button>

          {hasLinkedParty ? (
            <>
              <button
                type="button"
                className={[
                  'header-button header-party-control__icon-button',
                  publishOutOfSync ? 'header-party-control__icon-button--dirty' : '',
                  publishDisabledReason && !publishBusy && !publishBlockedByLayout
                    ? 'header-party-control__icon-button--blocked'
                    : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                disabled={publishBlockedByLayout || publishBusy}
                aria-disabled={publishDisabled}
                aria-busy={publishBusy}
                title={publishTitle}
                aria-label={`Обновить на сайте. ${publishTitle}`}
                onClick={handlePublishClick}
              >
                <CloudUploadOutlinedIcon fontSize="inherit" />
              </button>

              <button
                type="button"
                className="header-button header-party-control__icon-button"
                disabled={disabled}
                title={disabled ? LAYOUT_EDIT_DISABLED_TITLE : SETTINGS_BUTTON_TITLE}
                aria-label={SETTINGS_BUTTON_ARIA_LABEL}
                onClick={handleSettingsClick}
              >
                <SettingsOutlinedIcon fontSize="inherit" />
              </button>
            </>
          ) : null}
        </div>
      </div>

      {status.primary === 'Конец' ? <PartyProgramEndedReminder /> : null}

      {panelOpen && guideAnchorRect ? (
        <PartyGoToPlayGuidePanel
          anchorRect={guideAnchorRect}
          showGoButton={showGoButton}
          startLabel={panelStartLabel}
          mode={isGoToStopCta ? 'stop' : 'start'}
          excludeCloseRef={ctaRef}
          onGo={handleGo}
          onClose={closeGuide}
          onInteractionPause={pauseGuideDismiss}
          onInteractionResume={resumeGuideDismiss}
        />
      ) : null}
    </div>
  );
};
