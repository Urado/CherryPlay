import type { PartyLifecycleState } from '../types/api';

/** Все состояния жизненного цикла (CONTRACTS.md §6.7, snake_case в JSON). */
export const PARTY_LIFECYCLE_STATES = ['draft', 'ready', 'completed'] as const;

export function isPartyLifecycleState(value: unknown): value is PartyLifecycleState {
  return typeof value === 'string' && (PARTY_LIFECYCLE_STATES as readonly string[]).includes(value);
}

export const LIFECYCLE_STATUS_LABELS: Record<PartyLifecycleState, string> = {
  draft: 'Черновик',
  ready: 'Готова',
  completed: 'Завершена',
};

/** Целевые состояния, в которые разрешён переход из текущего (CONTRACTS §3.4). */
export function getAllowedLifecycleTargets(from: PartyLifecycleState): PartyLifecycleState[] {
  switch (from) {
    case 'draft':
      return ['ready'];
    case 'ready':
      return ['draft', 'completed'];
    case 'completed':
      return [];
  }
}

export function isTerminalLifecycleState(state: PartyLifecycleState): boolean {
  return state === 'completed';
}

/** Идемпотентный переход в то же состояние допустим. */
export function canTransitionLifecycle(
  from: PartyLifecycleState,
  to: PartyLifecycleState,
): boolean {
  return from === to || getAllowedLifecycleTargets(from).includes(to);
}
