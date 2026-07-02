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

export interface PartyEditorShellProps {
  phase: PartyEditorPhase | null;
  linkedParty?: PartyEditorLinkedParty | null;
  isBlocked: boolean;
  blockedReason: PartyEditorBlockedReason | null;
  blockedOverlayProps?: Omit<PartyEditorBlockedOverlayProps, 'reason'>;
  headerActions?: React.ReactNode;
  children: React.ReactNode;
}

export const PartyEditorShell: React.FC<PartyEditorShellProps> = ({
  phase,
  linkedParty,
  isBlocked,
  blockedReason,
  blockedOverlayProps,
  headerActions,
  children,
}) => {
  const headerTitle = phase
    ? PARTY_EDITOR_PHASE_HEADERS[phase]
    : PARTY_EDITOR_PHASE_HEADERS['draft-unlinked'];
  const badgeLifecycle = phase ? PARTY_EDITOR_PHASE_BADGE_LABELS[phase] : undefined;
  const badgeLabel = badgeLifecycle ? PARTY_EDITOR_LIFECYCLE_BADGE_LABELS[badgeLifecycle] : null;

  return (
    <div className="party-editor-shell">
      {linkedParty && (
        <div className="party-editor-shell-linked-banner">
          <span className="party-editor-shell-linked-banner-icon">🔗</span>
          <span className="party-editor-shell-linked-banner-text">
            Привязано к вечеринке: <strong>/{linkedParty.shortCode}</strong>
          </span>
          {linkedParty.url && (
            <a
              href={linkedParty.url}
              target="_blank"
              rel="noopener noreferrer"
              className="party-editor-shell-linked-banner-link"
            >
              Открыть в браузере
            </a>
          )}
        </div>
      )}

      <header className="party-editor-shell-header">
        <div className="party-editor-shell-header-main">
          <h2 className="party-editor-shell-title">{headerTitle}</h2>
          {badgeLabel && badgeLifecycle && (
            <span
              className={`party-editor-shell-phase-badge party-editor-shell-phase-badge--${badgeLifecycle}`}
            >
              {badgeLabel}
            </span>
          )}
        </div>
        {headerActions && <div className="party-editor-shell-header-actions">{headerActions}</div>}
      </header>

      <div className="party-editor-shell-body">{children}</div>

      {isBlocked && blockedReason && (
        <PartyEditorBlockedOverlay reason={blockedReason} {...blockedOverlayProps} />
      )}
    </div>
  );
};
