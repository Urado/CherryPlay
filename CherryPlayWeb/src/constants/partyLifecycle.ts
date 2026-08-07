import type { PartyLifecycleState } from '../types/api';

export const PARTY_LIFECYCLE_STATES = ['draft', 'ready', 'completed'] as const;

export function isPartyLifecycleState(value: unknown): value is PartyLifecycleState {
  return typeof value === 'string' && (PARTY_LIFECYCLE_STATES as readonly string[]).includes(value);
}

export const LIFECYCLE_STATUS_LABELS: Record<PartyLifecycleState, string> = {
  draft: 'Черновик',
  ready: 'Ждёт начала',
  completed: 'В архиве',
};

export function getAllowedLifecycleTargets(from: PartyLifecycleState): PartyLifecycleState[] {
  switch (from) {
    case 'draft':
      return ['ready'];
    case 'ready':
      return ['completed'];
    case 'completed':
      return ['ready'];
  }
}

export function canTransitionLifecycle(
  from: PartyLifecycleState,
  to: PartyLifecycleState,
): boolean {
  return from === to || getAllowedLifecycleTargets(from).includes(to);
}

export function canToggleCatalogVisibility(state: PartyLifecycleState): boolean {
  return state === 'ready' || state === 'completed';
}
