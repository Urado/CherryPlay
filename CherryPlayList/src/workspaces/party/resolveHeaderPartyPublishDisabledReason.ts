import type { PartyLifecycleState } from '@shared/services/partyService';

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
  if (input.partyLifecycleState !== 'ready' && input.partyLifecycleState !== 'draft') {
    return 'Нечего отправлять на сайт';
  }
  return null;
}
