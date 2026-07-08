import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import React from 'react';

import {
  PARTY_EDITOR_LIFECYCLE_BADGE_LABELS,
  PARTY_EDITOR_PHASE_BADGE_LABELS,
  PARTY_EDITOR_PHASE_HEADERS,
  type PartyEditorBlockedReason,
  type PartyEditorLinkedParty,
  type PartyEditorPhase,
} from '../partyEditorPhase';

import {
  PartyEditorBlockedOverlay,
  type PartyEditorBlockedOverlayProps,
} from './PartyEditorBlockedOverlay';
import './PartyEditorShell.css';

const PARTY_READY_PUBLISH_HINT =
  '1. Отправьте плейлист на сайт → 2. Запустите проигрывание в зоне плеера. Гости увидят актуальную программу, когда вечеринка в эфире.';

export interface PartyEditorShellProps {
  phase: PartyEditorPhase | null;
  linkedParty?: PartyEditorLinkedParty | null;
  onCopyUrl?: () => void;
  isBlocked: boolean;
  blockedReason: PartyEditorBlockedReason | null;
  blockedOverlayProps?: Omit<PartyEditorBlockedOverlayProps, 'reason'>;
  headerActions?: React.ReactNode;
  hidePhaseBadge?: boolean;
  connectivityBanner?: React.ReactNode;
  children: React.ReactNode;
}

export const PartyEditorShell: React.FC<PartyEditorShellProps> = ({
  phase,
  linkedParty,
  onCopyUrl,
  isBlocked,
  blockedReason,
  blockedOverlayProps,
  headerActions,
  hidePhaseBadge = false,
  connectivityBanner,
  children,
}) => {
  const headerTitle = phase
    ? PARTY_EDITOR_PHASE_HEADERS[phase]
    : PARTY_EDITOR_PHASE_HEADERS['draft-unlinked'];
  const badgeLifecycle = phase ? PARTY_EDITOR_PHASE_BADGE_LABELS[phase] : undefined;
  const badgeLabel = badgeLifecycle ? PARTY_EDITOR_LIFECYCLE_BADGE_LABELS[badgeLifecycle] : null;

  return (
    <div className="party-editor-shell">
      <header className="party-editor-shell-header">
        <div className="party-editor-shell-header-main">
          <h2 className="party-editor-shell-title">{headerTitle}</h2>
          {phase === 'ready' && (
            <span
              className="party-editor-shell-info-hint"
              title={PARTY_READY_PUBLISH_HINT}
              role="img"
              aria-label={PARTY_READY_PUBLISH_HINT}
            >
              <InfoOutlinedIcon className="party-editor-shell-info-hint__icon" aria-hidden />
            </span>
          )}
          {badgeLabel && badgeLifecycle && !hidePhaseBadge && (
            <span
              className={`party-editor-shell-phase-badge party-editor-shell-phase-badge--${badgeLifecycle}`}
            >
              {badgeLabel}
            </span>
          )}
        </div>
        {headerActions && <div className="party-editor-shell-header-actions">{headerActions}</div>}
      </header>

      {linkedParty && (
        <div className="party-editor-shell-linked-banner">
          <span className="party-editor-shell-linked-banner-icon">🔗</span>
          <span className="party-editor-shell-linked-banner-text">
            Подключено к вечеринке: <strong>/{linkedParty.shortCode}</strong>
          </span>
          {linkedParty.url && (
            <>
              <a
                href={linkedParty.url}
                target="_blank"
                rel="noopener noreferrer"
                className="party-editor-shell-linked-banner-link"
              >
                Открыть в браузере
              </a>
              {onCopyUrl && (
                <button
                  type="button"
                  className="party-editor-shell-linked-banner-copy"
                  onClick={onCopyUrl}
                >
                  Скопировать URL
                </button>
              )}
            </>
          )}
        </div>
      )}

      {connectivityBanner}

      <div className="party-editor-shell-body">{children}</div>

      {isBlocked && blockedReason && (
        <PartyEditorBlockedOverlay reason={blockedReason} {...blockedOverlayProps} />
      )}
    </div>
  );
};
