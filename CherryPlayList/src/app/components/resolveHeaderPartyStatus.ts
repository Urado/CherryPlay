import type { ProjectSessionMode } from '@core/types/project';
import type { LayoutPreset } from '@core/types/workspacePreset';
import type { PartyLifecycleState } from '@shared/services/partyService';
import { resolvePartyLifecycleDisplayLabel } from '@workspaces/party/partyLifecycleLabels';

import { HEADER_PARTY_STATUS_UNREACHABLE_LABEL } from './headerPartyStatusVisuals';

export interface HeaderPartyStatusInput {
  linkedParty: { id: string; shortCode: string } | null | undefined;
  partyLifecycleState: PartyLifecycleState | null;
  sessionMode: ProjectSessionMode;
  serverUnreachable: boolean;
}

export interface HeaderPartyStatusDisplay {
  primary: string;
  secondary?: string;
}

const ONLINE_PARTY_LAYOUT_PRESETS: ReadonlySet<LayoutPreset> = new Set(['party', 'aimp-party']);

export function isOnlinePartyLayoutPreset(preset: LayoutPreset | null | undefined): boolean {
  return preset != null && ONLINE_PARTY_LAYOUT_PRESETS.has(preset);
}

export function resolveHeaderPartyStatus(input: HeaderPartyStatusInput): HeaderPartyStatusDisplay {
  const primary = resolvePartyLifecycleDisplayLabel({
    linkedParty: input.linkedParty ?? null,
    partyLifecycleState: input.partyLifecycleState,
    sessionMode: input.sessionMode,
  });

  return withUnreachableOverlay({ primary }, input.serverUnreachable);
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
