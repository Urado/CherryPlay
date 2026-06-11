import { BASIC_THEME_FAMILY_DEFAULT_ACCENTS, BASIC_THEME_FAMILY_IDS } from './paletteConstants';
import type {
  BaseThemeColorPalette,
  BaseThemeCustomColorPalette,
  BaseThemeFamilyPaletteId,
} from './paletteTypes';
import {
  mixHexColors,
  mixTowardBlack,
  mixTowardWhite,
  normalizeHexColor,
  paletteToCustom,
} from './paletteUtils';

const BASE_THEME_NEUTRAL_TRACK_SURFACE: Pick<
  BaseThemeColorPalette,
  'trackAreaBackground' | 'trackBackground'
> = {
  trackAreaBackground: '#2a2a2a',
  trackBackground: '#333333',
};

/** Светлые поверхности списка/трека для семейства «Светлый акцент» (фиксированные нейтральные тона). */
const LIGHT_ACCENT_TRACK_SURFACE: Pick<
  BaseThemeColorPalette,
  'trackAreaBackground' | 'trackBackground'
> = {
  trackAreaBackground: '#efefef',
  trackBackground: '#e0e0e0',
};

const DARK_GRADIENT_MIX = {
  textTowardWhite: 56,
  bgTowardBlack: 78.5,
  areaTowardBlack: 73,
  trackTowardBlack: 67,
} as const;

const LIGHT_GRADIENT_MIX = {
  textTowardBlack: 50,
  bgTowardWhite: 91,
  areaTowardWhite: 81.5,
  trackTowardWhite: 72,
} as const;

const DARK_NEON_MIX = {
  textTowardWhite: 100,
  bgTowardBlack: 96.25,
} as const;

export function deriveDarkGradientFromAccent(accentInput: string): BaseThemeColorPalette {
  const accent = normalizeHexColor(accentInput) ?? BASIC_THEME_FAMILY_DEFAULT_ACCENTS.darkGradient;
  return {
    nameRu: 'Тёмный градиент',
    accentPrimary: accent,
    textPrimary: mixTowardWhite(accent, DARK_GRADIENT_MIX.textTowardWhite),
    backgroundPrimary: mixTowardBlack(accent, DARK_GRADIENT_MIX.bgTowardBlack),
    trackAreaBackground: mixTowardBlack(accent, DARK_GRADIENT_MIX.areaTowardBlack),
    trackBackground: mixTowardBlack(accent, DARK_GRADIENT_MIX.trackTowardBlack),
  };
}

export function deriveLightGradientFromAccent(accentInput: string): BaseThemeColorPalette {
  const accent = normalizeHexColor(accentInput) ?? BASIC_THEME_FAMILY_DEFAULT_ACCENTS.lightGradient;
  return {
    nameRu: 'Светлый градиент',
    accentPrimary: accent,
    textPrimary: mixTowardBlack(accent, LIGHT_GRADIENT_MIX.textTowardBlack),
    backgroundPrimary: mixTowardWhite(accent, LIGHT_GRADIENT_MIX.bgTowardWhite),
    trackAreaBackground: mixTowardWhite(accent, LIGHT_GRADIENT_MIX.areaTowardWhite),
    trackBackground: mixTowardWhite(accent, LIGHT_GRADIENT_MIX.trackTowardWhite),
  };
}

export function deriveDarkNeonFromAccent(accentInput: string): BaseThemeColorPalette {
  const accent = normalizeHexColor(accentInput) ?? BASIC_THEME_FAMILY_DEFAULT_ACCENTS.darkNeon;
  return {
    nameRu: 'Тёмный неон',
    accentPrimary: accent,
    textPrimary: mixTowardWhite(accent, DARK_NEON_MIX.textTowardWhite),
    backgroundPrimary: mixTowardBlack(accent, DARK_NEON_MIX.bgTowardBlack),
    trackAreaBackground: BASE_THEME_NEUTRAL_TRACK_SURFACE.trackAreaBackground,
    trackBackground: BASE_THEME_NEUTRAL_TRACK_SURFACE.trackBackground,
  };
}

export function deriveLightAccentFromAccent(accentInput: string): BaseThemeColorPalette {
  const base = deriveLightGradientFromAccent(accentInput);
  return {
    ...base,
    nameRu: 'Светлый акцент',
    trackAreaBackground: LIGHT_ACCENT_TRACK_SURFACE.trackAreaBackground,
    trackBackground: LIGHT_ACCENT_TRACK_SURFACE.trackBackground,
  };
}

export function resolveFamilyPalette(
  id: BaseThemeFamilyPaletteId,
  accentInput: string,
): BaseThemeColorPalette {
  switch (id) {
    case 'darkGradient':
      return deriveDarkGradientFromAccent(accentInput);
    case 'lightGradient':
      return deriveLightGradientFromAccent(accentInput);
    case 'darkNeon':
      return deriveDarkNeonFromAccent(accentInput);
    case 'lightAccent':
      return deriveLightAccentFromAccent(accentInput);
  }
}

export function buildBasicFamilyCustomPalette(
  familyId: BaseThemeFamilyPaletteId,
  accentInput: string,
): BaseThemeCustomColorPalette {
  return paletteToCustom(resolveFamilyPalette(familyId, accentInput));
}

export function isBasicThemeFamilyPaletteId(value: string): value is BaseThemeFamilyPaletteId {
  return (BASIC_THEME_FAMILY_IDS as readonly string[]).includes(value);
}

export function buildSecondaryAccent(accentPrimary: string): string {
  return mixHexColors(accentPrimary, '#ffffff', 25);
}
