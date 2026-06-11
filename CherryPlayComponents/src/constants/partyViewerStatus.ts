export const PARTY_DISPLAY_STATUS_IDS = [
  'draft',
  'scheduled',
  'starting_soon',
  'live',
  'organizer_offline',
  'party_ended',
] as const;

export type PartyDisplayStatusId = (typeof PARTY_DISPLAY_STATUS_IDS)[number];

export const PARTY_VIEWER_CLIENT_STATUS_IDS = [
  'connecting',
  'server_unreachable',
  'program_ended',
] as const;

export type PartyViewerClientStatusId = (typeof PARTY_VIEWER_CLIENT_STATUS_IDS)[number];

export type PartyViewerStatusId = PartyDisplayStatusId | PartyViewerClientStatusId;

export interface PartyViewerStatus {
  id: PartyViewerStatusId;
  label: string;
  ariaLabel: string;
}

export const PARTY_VIEWER_STATUS_LABELS: Record<
  PartyViewerStatusId,
  { label: string; ariaLabel: string }
> = {
  draft: { label: 'Черновик', ariaLabel: 'Вечеринка в черновике' },
  scheduled: { label: 'Запланирована', ariaLabel: 'Вечеринка запланирована' },
  starting_soon: { label: 'Скоро начнём', ariaLabel: 'Скоро начнём' },
  live: { label: 'Вечеринка идёт', ariaLabel: 'Вечеринка идёт' },
  organizer_offline: { label: 'Организатор не в сети', ariaLabel: 'Организатор не в сети' },
  party_ended: { label: 'Вечеринка окончена', ariaLabel: 'Вечеринка окончена' },
  program_ended: { label: 'Конец программы', ariaLabel: 'Конец программы' },
  connecting: { label: 'Подключение…', ariaLabel: 'Подключение к серверу' },
  server_unreachable: { label: 'Нет связи с сервером', ariaLabel: 'Нет связи с сервером' },
};

export function isPartyDisplayStatusId(value: unknown): value is PartyDisplayStatusId {
  return (
    typeof value === 'string' && (PARTY_DISPLAY_STATUS_IDS as readonly string[]).includes(value)
  );
}

export function partyViewerStatusFromId(id: PartyViewerStatusId): PartyViewerStatus {
  const copy = PARTY_VIEWER_STATUS_LABELS[id];
  return { id, label: copy.label, ariaLabel: copy.ariaLabel };
}
