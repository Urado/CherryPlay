import type { PartyLifecycleDisplayLabel } from '@workspaces/party/partyLifecycleLabels';

export const HEADER_PARTY_STATUS_UNREACHABLE_LABEL = 'нет связи';

export const HEADER_PARTY_CONTROL_STAGE_LABELS = [
  'Не создана',
  'Ждёт начала',
  'Идёт',
  'В архиве',
] as const;

export type HeaderPartyControlStageLabel = (typeof HEADER_PARTY_CONTROL_STAGE_LABELS)[number];

const PRIMARY_TITLES: Record<PartyLifecycleDisplayLabel, string> = {
  'Не создана': 'Вечеринка на сервере ещё не создана — только этот проект',
  Черновик:
    'Есть на сервере, ещё готовится. Это не «скрыта из каталога» — каталог настраивается отдельно («По ссылке» / «В каталоге»)',
  'Ждёт начала': 'Доступна для гостей, проигрывание ещё не запущено',
  Идёт: 'Сейчас идёт проигрывание; гости видят актуальное состояние',
  'В архиве': 'Вечеринка в архиве; можно вернуть в «Ждёт начала»',
};

const EXTRA_PRIMARY_TITLES: Record<string, string> = {
  Пауза: 'Проигрывание на паузе; сессия ещё активна',
  Конец: 'Последний трек доиграл; сессия ещё не завершена',
};

const UNREACHABLE_TITLE = 'Нет связи с сервером';

export function resolveHeaderPartyStatusTooltip(label: string): string | null {
  if (label === HEADER_PARTY_STATUS_UNREACHABLE_LABEL) {
    return UNREACHABLE_TITLE;
  }
  if (label in PRIMARY_TITLES) {
    return PRIMARY_TITLES[label as PartyLifecycleDisplayLabel];
  }
  if (label in EXTRA_PRIMARY_TITLES) {
    return EXTRA_PRIMARY_TITLES[label];
  }
  return null;
}

export function resolveHeaderPartyControlActiveStageIndex(primaryLabel: string): number {
  switch (primaryLabel) {
    case 'Не создана':
      return 0;
    case 'Черновик':
    case 'Ждёт начала':
      return 1;
    case 'Идёт':
    case 'Пауза':
    case 'Конец':
      return 2;
    case 'В архиве':
      return 3;
    default:
      return 0;
  }
}

export function resolveHeaderPartyControlCtaLabel(primaryLabel: string): string {
  switch (primaryLabel) {
    case 'Не создана':
      return 'Создать';
    case 'Черновик':
      return 'К настройкам';
    case 'Ждёт начала':
      return 'К игре';
    case 'Идёт':
      return 'К остановке';
    case 'Пауза':
    case 'Конец':
      return 'К игре';
    case 'В архиве':
      return 'Вернуть из архива';
    default:
      return 'Создать';
  }
}
