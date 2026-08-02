import type { ProjectSessionMode } from '@core/types/project';
import type { PartyLifecycleState } from '@shared/services/partyService';

export type PartyLifecycleDisplayLabel = 'Локально' | 'Черновик' | 'Не начато' | 'Идёт' | 'Архив';

export interface ResolvePartyLifecycleDisplayLabelInput {
  linkedParty: { id: string; shortCode: string } | null | undefined;
  partyLifecycleState: PartyLifecycleState | null;
  sessionMode?: ProjectSessionMode;
}

export const PARTY_LIFECYCLE_SERVER_BADGE_LABELS: Record<PartyLifecycleState, string> = {
  draft: 'Черновик',
  ready: 'Не начато',
  completed: 'Архив',
};

export function resolvePartyLifecycleDisplayLabel(
  input: ResolvePartyLifecycleDisplayLabelInput,
): PartyLifecycleDisplayLabel {
  if (!input.linkedParty) {
    return 'Локально';
  }

  const lifecycle = input.partyLifecycleState ?? 'draft';
  if (lifecycle === 'completed') {
    return 'Архив';
  }
  if (lifecycle === 'ready') {
    return input.sessionMode === 'session' ? 'Идёт' : 'Не начато';
  }
  return 'Черновик';
}

export function resolvePartyLifecycleServerBadgeLabel(
  lifecycle: PartyLifecycleState,
  sessionMode?: ProjectSessionMode,
): string {
  if (lifecycle === 'ready' && sessionMode === 'session') {
    return 'Идёт';
  }
  return PARTY_LIFECYCLE_SERVER_BADGE_LABELS[lifecycle];
}
