import type { PartyLifecycleDisplayLabel } from '@workspaces/party/partyLifecycleLabels';

export const HEADER_PARTY_STATUS_UNREACHABLE_LABEL = 'нет связи';

const PRIMARY_TITLES: Record<PartyLifecycleDisplayLabel, string> = {
  'Не создана': 'Вечеринка на сервере ещё не создана — только этот проект',
  Черновик:
    'Есть на сервере, ещё готовится. Это не «скрыта из каталога» — каталог настраивается отдельно («По ссылке» / «В каталоге»)',
  'Ждёт начала': 'Опубликована для гостей, проигрывание ещё не запущено',
  Идёт: 'Сейчас идёт проигрывание; гости видят актуальное состояние',
  Завершена: 'Вечеринка завершена',
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
