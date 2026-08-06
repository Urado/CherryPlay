import React from 'react';

import type { ProjectSessionMode } from '@core/types/project';

import {
  PARTY_EDITOR_PHASE_BADGE_LABELS,
  PARTY_EDITOR_PHASE_HEADERS,
  type PartyEditorBlockedReason,
  type PartyEditorPhase,
  resolvePartyLifecycleServerBadgeLabel,
} from '../partyEditorPhase';

import {
  PartyEditorBlockedOverlay,
  type PartyEditorBlockedOverlayProps,
} from './PartyEditorBlockedOverlay';
import './PartyEditorShell.css';

export interface PartyEditorShellProps {
  phase: PartyEditorPhase | null;
  isBlocked: boolean;
  blockedReason: PartyEditorBlockedReason | null;
  blockedOverlayProps?: Omit<PartyEditorBlockedOverlayProps, 'reason'>;
  headerActions?: React.ReactNode;
  hidePhaseBadge?: boolean;
  sessionMode?: ProjectSessionMode;
  connectivityBanner?: React.ReactNode;
  children: React.ReactNode;
}

export const PartyEditorShell: React.FC<PartyEditorShellProps> = ({
  phase,
  isBlocked,
  blockedReason,
  blockedOverlayProps,
  headerActions,
  hidePhaseBadge = false,
  sessionMode,
  connectivityBanner,
  children,
}) => {
  const headerTitle = phase
    ? PARTY_EDITOR_PHASE_HEADERS[phase]
    : PARTY_EDITOR_PHASE_HEADERS['draft-unlinked'];
  const badgeLifecycle = phase ? PARTY_EDITOR_PHASE_BADGE_LABELS[phase] : undefined;
  const badgeLabel = badgeLifecycle
    ? resolvePartyLifecycleServerBadgeLabel(badgeLifecycle, sessionMode)
    : null;

  return (
    <div className="party-editor-shell">
      <header className="party-editor-shell-header">
        <div className="party-editor-shell-header-main">
          <h2 className="party-editor-shell-title">{headerTitle}</h2>
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

      {connectivityBanner}

      <div className="party-editor-shell-body">{children}</div>

      {isBlocked && blockedReason && (
        <PartyEditorBlockedOverlay reason={blockedReason} {...blockedOverlayProps} />
      )}
    </div>
  );
};
