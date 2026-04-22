import {
  buildBasicFamilyCustomPalette,
  buildSecondaryAccent,
  deriveDarkGradientFromAccent,
  deriveDarkNeonFromAccent,
  deriveLightAccentFromAccent,
  deriveLightGradientFromAccent,
  isBasicThemeFamilyPaletteId,
  resolveFamilyPalette,
} from './familyPalettes';
import {
  DEFAULT_BASIC_THEME_CUSTOMIZATION_SETTINGS,
  normalizeBasicThemePaletteSettings,
  sanitizeBasicUserSavedPalettes,
} from './normalizePaletteSettings';
import {
  BASE_THEME_COLOR_PALETTES,
  buildBasicThemePaletteCatalog,
  getDefaultBasicThemeCustomPalette,
  isBasicThemePaletteId,
  parseBasicThemeUserSavedCatalogId,
} from './paletteCatalog';
import {
  ACTIVE_BASIC_THEME_PALETTE,
  BASIC_THEME_CUSTOMIZATION_OPTION_KEYS,
  BASIC_THEME_DARK_GRADIENT_PRESETS,
  BASIC_THEME_DARK_NEON_PRESETS,
  BASIC_THEME_FAMILY_IDS,
  BASIC_THEME_LIGHT_ACCENT_PRESETS,
  BASIC_THEME_LIGHT_GRADIENT_PRESETS,
  BASIC_THEME_MANUAL_PALETTE_LABEL,
  BASIC_THEME_USER_SAVED_CATALOG_PREFIX,
  DEFAULT_BASIC_THEME_ACCENT,
  DEFAULT_BASIC_THEME_CUSTOM_PALETTE,
  DEFAULT_BASIC_THEME_PALETTE,
} from './paletteConstants';
import type {
  BaseThemeColorPalette,
  BaseThemeColorPaletteCatalogItem,
  BaseThemeColorPaletteSettings,
  BaseThemeResolvedCssVars,
} from './paletteTypes';
import {
  areBasicCustomPalettesEqual,
  mixHexColors,
  normalizeHexColor,
  withAlpha,
} from './paletteUtils';

export type {
  BaseThemeColorPaletteId,
  BaseThemeColorPaletteSelectionId,
  BaseThemeColorPalette,
  BaseThemeCustomColorPalette,
  BaseThemeColorPaletteSettings,
  BaseThemeColorCustomizationSettings,
  BaseThemeColorPaletteCatalogItem,
  BaseThemeFamilyPaletteId,
  BaseThemeUserSavedPalette,
  BaseThemeResolvedCssVars,
} from './paletteTypes';

export {
  ACTIVE_BASIC_THEME_PALETTE,
  areBasicCustomPalettesEqual,
  BASE_THEME_COLOR_PALETTES,
  BASIC_THEME_CUSTOMIZATION_OPTION_KEYS,
  BASIC_THEME_DARK_GRADIENT_PRESETS,
  BASIC_THEME_DARK_NEON_PRESETS,
  BASIC_THEME_FAMILY_IDS,
  BASIC_THEME_LIGHT_ACCENT_PRESETS,
  BASIC_THEME_LIGHT_GRADIENT_PRESETS,
  BASIC_THEME_MANUAL_PALETTE_LABEL,
  BASIC_THEME_USER_SAVED_CATALOG_PREFIX,
  buildBasicFamilyCustomPalette,
  buildBasicThemePaletteCatalog,
  DEFAULT_BASIC_THEME_ACCENT,
  DEFAULT_BASIC_THEME_CUSTOM_PALETTE,
  DEFAULT_BASIC_THEME_CUSTOMIZATION_SETTINGS,
  DEFAULT_BASIC_THEME_PALETTE,
  deriveDarkGradientFromAccent,
  deriveDarkNeonFromAccent,
  deriveLightAccentFromAccent,
  deriveLightGradientFromAccent,
  getDefaultBasicThemeCustomPalette,
  isBasicThemeFamilyPaletteId,
  isBasicThemePaletteId,
  normalizeBasicThemePaletteSettings,
  normalizeHexColor,
  parseBasicThemeUserSavedCatalogId,
  sanitizeBasicUserSavedPalettes,
};

export function getBasicThemePaletteCatalog(
  settings?: Partial<Record<string, unknown>>,
): BaseThemeColorPaletteCatalogItem[] {
  return buildBasicThemePaletteCatalog(normalizeBasicThemePaletteSettings(settings));
}

type BasicThemeResolvedPalette = BaseThemeColorPaletteSettings & {
  palette: BaseThemeColorPalette;
};

export function resolveBasicThemePalette(
  settings?: Partial<Record<string, unknown>>,
): BasicThemeResolvedPalette {
  const normalized = normalizeBasicThemePaletteSettings(settings);
  const palette =
    normalized.paletteId === 'custom'
      ? { nameRu: BASIC_THEME_MANUAL_PALETTE_LABEL, ...normalized.customPalette }
      : isBasicThemeFamilyPaletteId(normalized.paletteId)
        ? resolveFamilyPalette(normalized.paletteId, normalized.customPalette.accentPrimary)
        : BASE_THEME_COLOR_PALETTES[normalized.paletteId];
  return { ...normalized, palette };
}

export function resolveBasicThemeCssSettings(
  settings?: Partial<Record<string, unknown>>,
): BaseThemeResolvedCssVars {
  const selectedPalette = resolveBasicThemePalette(settings).palette;
  const textPrimary = selectedPalette.textPrimary;
  const textSecondary = withAlpha(textPrimary, 0.72);
  const textTertiary = withAlpha(textPrimary, 0.5);
  const secondaryColor = buildSecondaryAccent(selectedPalette.accentPrimary);
  const backgroundHover = mixHexColors(selectedPalette.trackBackground, '#ffffff', 6);
  const selectedBackground = mixHexColors(
    selectedPalette.trackBackground,
    selectedPalette.accentPrimary,
    22,
  );
  const partyInfoMetaBorderTop = withAlpha(textPrimary, 0.1);

  return {
    primaryColor: selectedPalette.accentPrimary,
    secondaryColor,
    'bg-primary': selectedPalette.backgroundPrimary,
    'bg-secondary': selectedPalette.trackAreaBackground,
    'bg-tertiary': selectedPalette.trackBackground,
    'bg-hover': backgroundHover,
    'text-primary': textPrimary,
    'text-secondary': textSecondary,
    'text-tertiary': textTertiary,
    'selected-bg': selectedBackground,
    'party-info-meta-border-top': partyInfoMetaBorderTop,
    'shadow-black-15': 'rgba(0, 0, 0, 0.15)',
    'shadow-black-20': 'rgba(0, 0, 0, 0.2)',
    'shadow-black-30': 'rgba(0, 0, 0, 0.3)',
    'shadow-white-05': 'rgba(255, 255, 255, 0.05)',
  };
}

const DEFAULT_CSS_SETTINGS = resolveBasicThemeCssSettings();

export const BASE_THEME_ACCENT_PRIMARY = DEFAULT_CSS_SETTINGS.primaryColor;
export const BASE_THEME_ACCENT_SECONDARY = DEFAULT_CSS_SETTINGS.secondaryColor;
export const BASE_THEME_BACKGROUND_PRIMARY = DEFAULT_CSS_SETTINGS['bg-primary'];
export const BASE_THEME_BACKGROUND_SECONDARY = DEFAULT_CSS_SETTINGS['bg-secondary'];
export const BASE_THEME_BACKGROUND_TERTIARY = DEFAULT_CSS_SETTINGS['bg-tertiary'];
export const BASE_THEME_BACKGROUND_HOVER = DEFAULT_CSS_SETTINGS['bg-hover'];
export const BASE_THEME_TEXT_PRIMARY = DEFAULT_CSS_SETTINGS['text-primary'];
export const BASE_THEME_TEXT_SECONDARY = DEFAULT_CSS_SETTINGS['text-secondary'];
export const BASE_THEME_TEXT_TERTIARY = DEFAULT_CSS_SETTINGS['text-tertiary'];
export const BASE_THEME_SELECTED_BACKGROUND = DEFAULT_CSS_SETTINGS['selected-bg'];
export const BASE_THEME_PARTY_INFO_META_BORDER_TOP =
  DEFAULT_CSS_SETTINGS['party-info-meta-border-top'];

export const BASE_THEME_SHADOW_BLACK_15 = DEFAULT_CSS_SETTINGS['shadow-black-15'];
export const BASE_THEME_SHADOW_BLACK_20 = DEFAULT_CSS_SETTINGS['shadow-black-20'];
export const BASE_THEME_SHADOW_BLACK_30 = DEFAULT_CSS_SETTINGS['shadow-black-30'];
export const BASE_THEME_SHADOW_WHITE_05 = DEFAULT_CSS_SETTINGS['shadow-white-05'];

export const BASIC_THEME_TRACK = {
  background: BASE_THEME_BACKGROUND_TERTIARY,
  selectedBackground: BASE_THEME_SELECTED_BACKGROUND,
} as const;

export const BASIC_THEME_TRACK_AREA = {
  background: BASE_THEME_BACKGROUND_SECONDARY,
  hoverBackground: BASE_THEME_BACKGROUND_HOVER,
} as const;

export const BASIC_THEME_BACKGROUND = {
  primary: BASE_THEME_BACKGROUND_PRIMARY,
} as const;

export const BASIC_THEME_ACCENTS = {
  primary: BASE_THEME_ACCENT_PRIMARY,
  secondary: BASE_THEME_ACCENT_SECONDARY,
} as const;

export const BASIC_THEME_PALETTES = BASE_THEME_COLOR_PALETTES;
