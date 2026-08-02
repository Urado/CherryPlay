import DashboardIcon from '@mui/icons-material/Dashboard';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import React, { useCallback } from 'react';

import type { Layout } from '@core/types/layout';
import type { ActiveWorkspace } from '@core/types/workspacePreset';
import { useLayoutStore, useProjectStore } from '@shared/stores';
import { getLayoutPresetFromLayout } from '@shared/utils/layoutPreset';
import { collectWorkspaceTypes } from '@shared/utils/layoutWorkspaceOperations';

import { usePartyWorkspaceStore } from '../../workspaces/party/partyWorkspaceStore';

import { resolveHeaderPartyStatusTooltip } from './headerPartyStatusVisuals';
import { isOnlinePartyLayoutPreset, resolveHeaderPartyStatus } from './resolveHeaderPartyStatus';
import { LAYOUT_EDIT_DISABLED_TITLE } from './workspaceLayoutEditOptions';

const GO_TO_PARTY_LABEL = 'К вечеринке';
const GO_TO_PARTY_TITLE = 'Переключить раскладку на «Онлайн-вечеринка»';
const ALREADY_ON_PARTY_TITLE = 'Раскладка вечеринки уже открыта';

function layoutHasOnlinePartyZones(layout: Layout): boolean {
  const types = collectWorkspaceTypes(layout.rootZone);
  return types.has('party-editor') && types.has('party-preview');
}

function isAlreadyOnOnlinePartyLayout(activeWorkspace: ActiveWorkspace, layout: Layout): boolean {
  if (activeWorkspace.kind === 'builtin' && isOnlinePartyLayoutPreset(activeWorkspace.preset)) {
    return true;
  }
  if (isOnlinePartyLayoutPreset(getLayoutPresetFromLayout(layout))) {
    return true;
  }
  return layoutHasOnlinePartyZones(layout);
}

function StatusChip({
  label,
  className,
}: {
  label: string;
  className: string;
}): React.ReactElement {
  const tooltip = resolveHeaderPartyStatusTooltip(label);

  return (
    <span className={className} role="status" aria-label={label}>
      <span className="header-party-status__label">{label}</span>
      {tooltip ? (
        <span className="header-party-status__info" title={tooltip} aria-label={tooltip} role="img">
          <InfoOutlinedIcon fontSize="inherit" aria-hidden />
        </span>
      ) : null}
    </span>
  );
}

export interface HeaderPartyStatusProps {
  disabled?: boolean;
}

export const HeaderPartyStatus: React.FC<HeaderPartyStatusProps> = ({ disabled = false }) => {
  const linkedParty = useProjectStore((state) => state.meta.linkedParty);
  const sessionMode = useProjectStore((state) => state.sessionState.mode);
  const partyLifecycleState = usePartyWorkspaceStore((state) => state.partyLifecycleState);
  const serverUnreachable = usePartyWorkspaceStore((state) => state.serverUnreachable);
  const activeWorkspace = useLayoutStore((state) => state.activeWorkspace);
  const layout = useLayoutStore((state) => state.layout);
  const setLayoutPreset = useLayoutStore((state) => state.setLayoutPreset);

  const status = resolveHeaderPartyStatus({
    linkedParty,
    partyLifecycleState,
    sessionMode,
    serverUnreachable,
  });

  const alreadyOnPartyLayout = isAlreadyOnOnlinePartyLayout(activeWorkspace, layout);
  const buttonDisabled = disabled || alreadyOnPartyLayout;
  const buttonTitle = disabled
    ? LAYOUT_EDIT_DISABLED_TITLE
    : alreadyOnPartyLayout
      ? ALREADY_ON_PARTY_TITLE
      : GO_TO_PARTY_TITLE;

  const handleGoToParty = useCallback(() => {
    if (disabled) {
      return;
    }
    const state = useLayoutStore.getState();
    if (isAlreadyOnOnlinePartyLayout(state.activeWorkspace, state.layout)) {
      return;
    }
    setLayoutPreset('party');
  }, [disabled, setLayoutPreset]);

  return (
    <div className="header-party-status" role="group" aria-label="Статус вечеринки">
      <div className="header-party-status__summary">
        {status.primary ? (
          <StatusChip label={status.primary} className="header-party-status__primary" />
        ) : null}
        {status.secondary ? (
          <StatusChip label={status.secondary} className="header-party-status__secondary" />
        ) : null}
      </div>
      <button
        type="button"
        className="header-button header-party-status__button"
        onClick={handleGoToParty}
        disabled={buttonDisabled}
        title={buttonTitle}
        aria-label={`${GO_TO_PARTY_LABEL}. ${buttonTitle}`}
      >
        <span className="header-party-status__icon" aria-hidden>
          <DashboardIcon fontSize="inherit" />
        </span>
      </button>
    </div>
  );
};
