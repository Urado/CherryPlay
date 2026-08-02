import type { PartyLifecycleState } from '@shared/services/partyService';

import {
  PARTY_LIFECYCLE_SERVER_BADGE_LABELS,
  resolvePartyLifecycleServerBadgeLabel,
} from './partyLifecycleLabels';
import { ERROR_PARTY_NOT_FOUND } from './partyWorkspaceConstants';

export type PartyEditorPhase = 'draft-unlinked' | 'draft-linked' | 'ready' | 'completed';

export type PartyEditorBlockedReason =
  | 'auth'
  | 'outdated'
  | 'checking'
  | 'unreachable'
  | 'party-not-found';

export interface PartyEditorLinkedParty {
  id: string;
  shortCode: string;
  url?: string;
}

export interface ResolvePartyEditorPhaseInput {
  isAuth: boolean;
  isClientOutdated: boolean;
  isCheckingParty: boolean;
  linkedParty?: PartyEditorLinkedParty | null;
  partyLifecycleState?: PartyLifecycleState | null;
  serverError?: string | null;
}

export interface PartyEditorPhaseResult {
  phase: PartyEditorPhase | null;
  blockedReason: PartyEditorBlockedReason | null;
  isBlocked: boolean;
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

export const PARTY_EDITOR_LIFECYCLE_BADGE_LABELS: Record<PartyLifecycleState, string> =
  PARTY_LIFECYCLE_SERVER_BADGE_LABELS;

export { resolvePartyLifecycleServerBadgeLabel };

export function applyDemoBlockedOverride(
  baseResult: PartyEditorPhaseResult,
  input: ResolvePartyEditorPhaseInput,
  demoBlockedOverride: PartyEditorBlockedReason | null,
): PartyEditorPhaseResult {
  if (demoBlockedOverride == null) {
    return baseResult;
  }

  const unblocked = resolvePartyEditorPhase({
    ...input,
    isAuth: true,
    isClientOutdated: false,
    isCheckingParty: false,
  });

  return {
    phase: unblocked.phase,
    blockedReason: demoBlockedOverride,
    isBlocked: true,
    effectiveLifecycle: unblocked.effectiveLifecycle,
  };
}

export function shouldPreserveShellContentWhenBlocked(
  demoBlockedOverride: PartyEditorBlockedReason | null,
): boolean {
  return demoBlockedOverride != null;
}

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

  let result: PartyEditorPhaseResult;
  if (lifecycle === 'completed') {
    result = {
      phase: 'completed',
      blockedReason: null,
      isBlocked: false,
      effectiveLifecycle: lifecycle,
    };
  } else if (lifecycle === 'ready') {
    result = {
      phase: 'ready',
      blockedReason: null,
      isBlocked: false,
      effectiveLifecycle: lifecycle,
    };
  } else {
    result = {
      phase: 'draft-linked',
      blockedReason: null,
      isBlocked: false,
      effectiveLifecycle: lifecycle,
    };
  }

  return applyPartyNotFoundBlocking(result, input);
}

function applyPartyNotFoundBlocking(
  result: PartyEditorPhaseResult,
  input: ResolvePartyEditorPhaseInput,
): PartyEditorPhaseResult {
  if (
    result.isBlocked ||
    input.linkedParty == null ||
    input.serverError !== ERROR_PARTY_NOT_FOUND
  ) {
    return result;
  }

  return {
    ...result,
    isBlocked: true,
    blockedReason: 'party-not-found',
  };
}

export function shouldShowPartyTrackDisplaySection(phase: PartyEditorPhase | null): boolean {
  return phase === 'draft-linked' || phase === 'ready';
}
