import type { PartyLifecycleState } from '@shared/services/partyService';

export type PartyEditorPhase = 'draft-unlinked' | 'draft-linked' | 'ready' | 'completed';

export type PartyEditorBlockedReason = 'auth' | 'outdated' | 'checking' | 'unreachable';

export interface PartyEditorLinkedParty {
  id: string;
  shortCode: string;
  url?: string;
}

export interface ResolvePartyEditorPhaseInput {
  isAuth: boolean;
  isClientOutdated: boolean;
  isCheckingParty: boolean;
  serverUnreachable: boolean;
  linkedParty?: PartyEditorLinkedParty | null;
  partyLifecycleState?: PartyLifecycleState | null;
}

export interface PartyEditorPhaseResult {
  phase: PartyEditorPhase | null;
  blockedReason: PartyEditorBlockedReason | null;
  isBlocked: boolean;
  /** Effective lifecycle when linked; null when unlinked. */
  effectiveLifecycle: PartyLifecycleState | null;
}

export const PARTY_EDITOR_PHASE_HEADERS: Record<PartyEditorPhase, string> = {
  'draft-unlinked': 'Создание вечеринки',
  'draft-linked': 'Редактирование вечеринки',
  ready: 'Публикация и настройки',
  completed: 'Завершённая вечеринка',
};

export const PARTY_EDITOR_PHASE_BADGE_LABELS: Partial<
  Record<PartyEditorPhase, PartyLifecycleState>
> = {
  'draft-linked': 'draft',
  ready: 'ready',
  completed: 'completed',
};

export const PARTY_EDITOR_LIFECYCLE_BADGE_LABELS: Record<PartyLifecycleState, string> = {
  draft: 'Черновик',
  ready: 'Готова',
  completed: 'Завершена',
};

export function resolvePartyEditorPhase(
  input: ResolvePartyEditorPhaseInput,
): PartyEditorPhaseResult {
  if (!input.isAuth) {
    return { phase: null, blockedReason: 'auth', isBlocked: true, effectiveLifecycle: null };
  }
  if (input.isClientOutdated) {
    return { phase: null, blockedReason: 'outdated', isBlocked: true, effectiveLifecycle: null };
  }
  if (input.isCheckingParty) {
    return { phase: null, blockedReason: 'checking', isBlocked: true, effectiveLifecycle: null };
  }
  if (input.serverUnreachable) {
    return {
      phase: null,
      blockedReason: 'unreachable',
      isBlocked: true,
      effectiveLifecycle: null,
    };
  }

  const linked = input.linkedParty != null;
  if (!linked) {
    return {
      phase: 'draft-unlinked',
      blockedReason: null,
      isBlocked: false,
      effectiveLifecycle: null,
    };
  }

  const lifecycle = input.partyLifecycleState ?? 'draft';

  if (lifecycle === 'completed') {
    return {
      phase: 'completed',
      blockedReason: null,
      isBlocked: false,
      effectiveLifecycle: lifecycle,
    };
  }
  if (lifecycle === 'ready') {
    return { phase: 'ready', blockedReason: null, isBlocked: false, effectiveLifecycle: lifecycle };
  }

  return {
    phase: 'draft-linked',
    blockedReason: null,
    isBlocked: false,
    effectiveLifecycle: lifecycle,
  };
}

export function shouldShowPartyTrackDisplaySection(phase: PartyEditorPhase | null): boolean {
  return phase === 'draft-linked' || phase === 'ready';
}
