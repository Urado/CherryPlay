import { PARTY_THEME_REGISTRY, type PartyThemeId } from '@cherryplay/components';

export interface PartyThemeOption {
  value: string;
  label: string;
}

export const PARTY_THEME_OPTIONS: PartyThemeOption[] = Object.entries(PARTY_THEME_REGISTRY).map(
  ([value, theme]) => ({
    value,
    label: theme.name,
  }),
);

export const getPartyThemeName = (partyThemeId: string): string => {
  const theme = PARTY_THEME_REGISTRY[partyThemeId as PartyThemeId];
  return theme?.name ?? partyThemeId;
};
