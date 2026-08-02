import type { PartyLifecycleDisplayLabel } from '@workspaces/party/partyLifecycleLabels';

export const HEADER_PARTY_STATUS_UNREACHABLE_LABEL = 'нет связи';

const PRIMARY_TITLES: Record<PartyLifecycleDisplayLabel, string> = {
  Локально: 'Проект ещё не привязан к вечеринке на сервере',
  Черновик: 'Вечеринка на сервере в черновике',
  'Не начато': 'Опубликована на сайте, ожидает начала',
  Идёт: 'Идёт локальная сессия проигрывания',
  Архив: 'Вечеринка в архиве',
};

const UNREACHABLE_TITLE = 'Нет связи с сервером';

export function resolveHeaderPartyStatusTooltip(label: string): string | null {
  if (label === HEADER_PARTY_STATUS_UNREACHABLE_LABEL) {
    return UNREACHABLE_TITLE;
  }
  if (label in PRIMARY_TITLES) {
    return PRIMARY_TITLES[label as PartyLifecycleDisplayLabel];
  }
  return null;
}
