import type { PartyLifecycleState } from '@shared/services/partyService';

export function hasNoPendingPartyPublishChanges(input: {
  hasLinkedParty: boolean;
  partyLifecycleState: PartyLifecycleState | null;
  hasSyncBaseline: boolean;
  isOutOfSync: boolean;
}): boolean {
  return (
    input.hasLinkedParty &&
    (input.partyLifecycleState === 'ready' || input.partyLifecycleState === 'draft') &&
    input.hasSyncBaseline &&
    !input.isOutOfSync
  );
}

export function resolveHeaderPartyPublishDisabledReason(input: {
  isAuthenticated: boolean;
  networkEnabled: boolean;
  hasLinkedParty: boolean;
  partyLifecycleState: PartyLifecycleState | null;
}): string | null {
  if (!input.networkEnabled) {
    return 'Включите «Онлайн» в настройках';
  }
  if (!input.isAuthenticated) {
    return 'Для обновления необходимо войти в аккаунт';
  }
  if (!input.hasLinkedParty) {
    return 'Сначала создайте или привяжите вечеринку';
  }
  if (input.partyLifecycleState === 'completed') {
    return 'Сначала верните вечеринку из архива';
  }
  if (input.partyLifecycleState == null) {
    return 'Статус вечеринки ещё не загружен';
  }
  return null;
}
