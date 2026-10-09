import type { Layout } from '@core/types/layout';
import type { ProjectSessionMode } from '@core/types/project';
import type { ActiveWorkspace, LayoutPreset } from '@core/types/workspacePreset';
import type { StorePlaybackStatus } from '@shared/contracts/storePlaybackStatus';
import type { PartyLifecycleState } from '@shared/services/partyService';
import { getLayoutPresetFromLayout } from '@shared/utils/layoutPreset';
import { collectWorkspaceTypes } from '@shared/utils/layoutWorkspaceOperations';
import { resolvePartyLifecycleDisplayLabel } from '@workspaces/party/partyLifecycleLabels';
import type { PartyPlaybackSourceState } from '@workspaces/party/partyPlaybackSource';

import { HEADER_PARTY_STATUS_UNREACHABLE_LABEL } from './headerPartyStatusVisuals';

export interface HeaderPartyStatusInput {
  linkedParty: { id: string; shortCode: string } | null | undefined;
  partyLifecycleState: PartyLifecycleState | null;
  sessionMode: ProjectSessionMode;
  serverUnreachable: boolean;
  playbackSourceState: PartyPlaybackSourceState;
  programEnded?: boolean;
}

export interface HeaderPartyStatusDisplay {
  primary: string;
  secondary?: string;
}

const ONLINE_PARTY_LAYOUT_PRESETS: ReadonlySet<LayoutPreset> = new Set(['party', 'aimp-party']);

export const isOnlinePartyLayoutPreset = (preset: LayoutPreset | null | undefined): boolean => {
  return preset != null && ONLINE_PARTY_LAYOUT_PRESETS.has(preset);
};

export const layoutHasOnlinePartyZones = (layout: Layout): boolean => {
  const types = collectWorkspaceTypes(layout.rootZone);
  return types.has('party-preview');
};

export const isAlreadyOnOnlinePartyLayout = (
  activeWorkspace: ActiveWorkspace,
  layout: Layout,
): boolean => {
  if (activeWorkspace.kind === 'builtin' && isOnlinePartyLayoutPreset(activeWorkspace.preset)) {
    return true;
  }
  if (isOnlinePartyLayoutPreset(getLayoutPresetFromLayout(layout))) {
    return true;
  }
  return layoutHasOnlinePartyZones(layout);
};

export const resolveHeaderPartyStatus = (
  input: HeaderPartyStatusInput,
): HeaderPartyStatusDisplay => {
  const basePrimary =
    input.linkedParty &&
    input.partyLifecycleState === 'ready' &&
    input.playbackSourceState.headerActive
      ? 'Идёт'
      : resolvePartyLifecycleDisplayLabel({
          linkedParty: input.linkedParty ?? null,
          partyLifecycleState: input.partyLifecycleState,
          sessionMode: input.sessionMode,
        });
  const primary = resolveHeaderPartyPlaybackOverlay(
    basePrimary,
    input.playbackSourceState.headerPlaybackStatus,
    input.programEnded === true,
  );

  return withUnreachableOverlay({ primary }, input.serverUnreachable);
};

const resolveHeaderPartyPlaybackOverlay = (
  primary: string,
  playbackStatus: StorePlaybackStatus | null | undefined,
  programEnded: boolean,
): string => {
  if (primary !== 'Идёт') {
    return primary;
  }
  if (programEnded) {
    return 'Конец';
  }
  if (playbackStatus === 'paused') {
    return 'Пауза';
  }
  return primary;
};

const withUnreachableOverlay = (
  display: HeaderPartyStatusDisplay,
  serverUnreachable: boolean,
): HeaderPartyStatusDisplay => {
  if (!serverUnreachable) {
    return display;
  }
  return { primary: display.primary, secondary: HEADER_PARTY_STATUS_UNREACHABLE_LABEL };
};
