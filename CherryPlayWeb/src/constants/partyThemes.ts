/**
 * Единый источник данных о PartyTheme из CherryPlayComponents.
 * Используется в PartyListPage (название темы в карточке) и CabinetPage (селект темы).
 */
import { PARTY_THEME_REGISTRY, type PartyThemeId } from '@cherryplay/components';

export interface PartyThemeOption {
  value: string;
  label: string;
}

/** Список PartyTheme для селекта (создание/редактирование вечеринки). */
export const PARTY_THEME_OPTIONS: PartyThemeOption[] = Object.entries(PARTY_THEME_REGISTRY).map(
  ([value, theme]) => ({
    value,
    label: theme.name,
  }),
);

/** Отображаемое имя PartyTheme по id (для карточек и списков). */
export function getPartyThemeName(partyThemeId: string): string {
  const theme = PARTY_THEME_REGISTRY[partyThemeId as PartyThemeId];
  return theme?.name ?? partyThemeId;
}
