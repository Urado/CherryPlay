import {
  buildBasicFamilyCustomPalette,
  isBasicThemeFamilyPaletteId,
  resolveFamilyPalette,
} from './familyPalettes';
import {
  BASIC_THEME_CATALOG_ORDER,
  BASIC_THEME_FAMILY_DEFAULT_ACCENTS,
  BASIC_THEME_MANUAL_PALETTE_LABEL,
  BASIC_THEME_USER_SAVED_CATALOG_PREFIX,
} from './paletteConstants';
import type {
  BaseThemeColorPalette,
  BaseThemeColorPaletteCatalogItem,
  BaseThemeColorPaletteId,
  BaseThemeColorPaletteSettings,
  BaseThemeCustomColorPalette,
} from './paletteTypes';
import { paletteToCustom } from './paletteUtils';

export const BASE_THEME_COLOR_PALETTES: Record<BaseThemeColorPaletteId, BaseThemeColorPalette> = {
  base: {
    nameRu: 'Базовый',
    accentPrimary: '#4a9eff',
    textPrimary: '#ffffff',
    backgroundPrimary: '#1a1a1a',
    trackAreaBackground: '#2a2a2a',
    trackBackground: '#333333',
  },
  darkGradient: resolveFamilyPalette(
    'darkGradient',
    BASIC_THEME_FAMILY_DEFAULT_ACCENTS.darkGradient,
  ),
  lightGradient: resolveFamilyPalette(
    'lightGradient',
    BASIC_THEME_FAMILY_DEFAULT_ACCENTS.lightGradient,
  ),
  darkNeon: resolveFamilyPalette('darkNeon', BASIC_THEME_FAMILY_DEFAULT_ACCENTS.darkNeon),
  lightAccent: resolveFamilyPalette('lightAccent', BASIC_THEME_FAMILY_DEFAULT_ACCENTS.lightAccent),
};

export function isBasicThemePaletteId(value: unknown): value is BaseThemeColorPaletteId {
  return typeof value === 'string' && value in BASE_THEME_COLOR_PALETTES;
}

export function getDefaultBasicThemeCustomPalette(
  seedPaletteId: BaseThemeColorPaletteId,
): BaseThemeCustomColorPalette {
  if (isBasicThemeFamilyPaletteId(seedPaletteId)) {
    return buildBasicFamilyCustomPalette(
      seedPaletteId,
      BASIC_THEME_FAMILY_DEFAULT_ACCENTS[seedPaletteId],
    );
  }
  return paletteToCustom(BASE_THEME_COLOR_PALETTES[seedPaletteId]);
}

export function parseBasicThemeUserSavedCatalogId(catalogId: string): string | null {
  const p = BASIC_THEME_USER_SAVED_CATALOG_PREFIX;
  if (!catalogId.startsWith(p)) {
    return null;
  }
  const id = catalogId.slice(p.length).trim();
  return id.length > 0 ? id : null;
}

export function buildBasicThemePaletteCatalog(
  normalized: BaseThemeColorPaletteSettings,
): BaseThemeColorPaletteCatalogItem[] {
  const predefinedItems: BaseThemeColorPaletteCatalogItem[] = BASIC_THEME_CATALOG_ORDER.map(
    (id) => {
      const palette =
        normalized.paletteId === id && isBasicThemeFamilyPaletteId(id)
          ? resolveFamilyPalette(id, normalized.customPalette.accentPrimary)
          : BASE_THEME_COLOR_PALETTES[id];
      return {
        id,
        label: BASE_THEME_COLOR_PALETTES[id].nameRu,
        palette,
        isCustom: false,
      };
    },
  );

  const userSavedItems: BaseThemeColorPaletteCatalogItem[] = (
    normalized.basicUserSavedPalettes ?? []
  ).map((entry) => ({
    id: `${BASIC_THEME_USER_SAVED_CATALOG_PREFIX}${entry.id}`,
    label: entry.name,
    palette: { nameRu: entry.name, ...entry.palette },
    isCustom: true,
    userSavedId: entry.id,
  }));

  return [
    ...predefinedItems,
    ...userSavedItems,
    {
      id: 'custom',
      label: BASIC_THEME_MANUAL_PALETTE_LABEL,
      palette: { nameRu: BASIC_THEME_MANUAL_PALETTE_LABEL, ...normalized.customPalette },
      isCustom: true,
    },
  ];
}
