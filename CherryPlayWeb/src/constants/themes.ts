/**
 * Единый источник данных о темах из CherryPlayComponents.
 * Используется в PartyListPage (название темы в карточке) и CabinetPage (селект темы).
 */
import { THEME_REGISTRY, type ThemeId } from '@cherryplay/components';

export interface ThemeOption {
  value: string;
  label: string;
}

/** Список тем для селекта (создание/редактирование вечеринки). */
export const THEME_OPTIONS: ThemeOption[] = Object.entries(THEME_REGISTRY).map(
  ([value, theme]) => ({
    value,
    label: theme.name,
  }),
);

/** Отображаемое имя темы по id (для карточек и списков). */
export function getThemeName(themeId: string): string {
  const theme = THEME_REGISTRY[themeId as ThemeId];
  return theme?.name ?? themeId;
}
