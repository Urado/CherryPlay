import type { Layout } from '@core/types/layout';
import type { ProjectSessionMode } from '@core/types/project';
import type { ActiveWorkspace, LayoutPreset } from '@core/types/workspacePreset';
import type { StorePlaybackStatus } from '@shared/contracts/storePlaybackStatus';
import type { PartyLifecycleState } from '@shared/services/partyService';
import { getLayoutPresetFromLayout } from '@shared/utils/layoutPreset';
import { collectWorkspaceTypes } from '@shared/utils/layoutWorkspaceOperations';
import { resolvePartyLifecycleDisplayLabel } from '@workspaces/party/partyLifecycleLabels';

import { HEADER_PARTY_STATUS_UNREACHABLE_LABEL } from './headerPartyStatusVisuals';

export interface HeaderPartyStatusInput {
  linkedParty: { id: string; shortCode: string } | null | undefined;
  partyLifecycleState: PartyLifecycleState | null;
  sessionMode: ProjectSessionMode;
  serverUnreachable: boolean;
  playbackStatus?: StorePlaybackStatus | null;
}

export interface HeaderPartyStatusDisplay {
  primary: string;
  secondary?: string;
}

const ONLINE_PARTY_LAYOUT_PRESETS: ReadonlySet<LayoutPreset> = new Set(['party', 'aimp-party']);

export function isOnlinePartyLayoutPreset(preset: LayoutPreset | null | undefined): boolean {
  return preset != null && ONLINE_PARTY_LAYOUT_PRESETS.has(preset);
}

export function layoutHasOnlinePartyZones(layout: Layout): boolean {
  const types = collectWorkspaceTypes(layout.rootZone);
  return types.has('party-editor') && types.has('party-preview');
}

export function isAlreadyOnOnlinePartyLayout(
  activeWorkspace: ActiveWorkspace,
  layout: Layout,
): boolean {
  if (activeWorkspace.kind === 'builtin' && isOnlinePartyLayoutPreset(activeWorkspace.preset)) {
    return true;
  }
  if (isOnlinePartyLayoutPreset(getLayoutPresetFromLayout(layout))) {
    return true;
  }
  return layoutHasOnlinePartyZones(layout);
}

export function resolveHeaderPartyStatus(input: HeaderPartyStatusInput): HeaderPartyStatusDisplay {
  const basePrimary = resolvePartyLifecycleDisplayLabel({
    linkedParty: input.linkedParty ?? null,
    partyLifecycleState: input.partyLifecycleState,
    sessionMode: input.sessionMode,
  });
  const primary = resolveHeaderPartyPlaybackOverlay(basePrimary, input.playbackStatus);

  return withUnreachableOverlay({ primary }, input.serverUnreachable);
}

function resolveHeaderPartyPlaybackOverlay(
  primary: string,
  playbackStatus: StorePlaybackStatus | null | undefined,
): string {
  if (primary !== 'Идёт') {
    return primary;
  }
  if (playbackStatus === 'paused') {
    return 'Пауза';
  }
  return primary;
}

function withUnreachableOverlay(
  display: HeaderPartyStatusDisplay,
  serverUnreachable: boolean,
): HeaderPartyStatusDisplay {
  if (!serverUnreachable) {
    return display;
  }
  return { primary: display.primary, secondary: HEADER_PARTY_STATUS_UNREACHABLE_LABEL };
}
