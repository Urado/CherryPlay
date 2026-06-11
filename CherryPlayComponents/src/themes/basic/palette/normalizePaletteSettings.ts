import { buildBasicFamilyCustomPalette, isBasicThemeFamilyPaletteId } from './familyPalettes';
import { getDefaultBasicThemeCustomPalette, isBasicThemePaletteId } from './paletteCatalog';
import {
  DEFAULT_BASIC_THEME_CUSTOM_PALETTE,
  DEFAULT_BASIC_THEME_PALETTE,
  BASIC_THEME_FAMILY_DEFAULT_ACCENTS,
} from './paletteConstants';
import type {
  BaseThemeColorPaletteSelectionId,
  BaseThemeColorPaletteSettings,
  BaseThemeColorCustomizationSettings,
  BaseThemeCustomColorPalette,
  BaseThemeUserSavedPalette,
} from './paletteTypes';
import {
  isValidFullCustomPalette,
  mergePartialCustomPalette,
  normalizeHexColor,
} from './paletteUtils';

export const DEFAULT_BASIC_THEME_CUSTOMIZATION_SETTINGS: BaseThemeColorCustomizationSettings = {
  paletteId: DEFAULT_BASIC_THEME_PALETTE,
  customPalette: { ...DEFAULT_BASIC_THEME_CUSTOM_PALETTE },
  basicUserSavedPalettes: [],
  basicActiveUserPaletteId: null,
};

export function sanitizeBasicUserSavedPalettes(raw: unknown): BaseThemeUserSavedPalette[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const out: BaseThemeUserSavedPalette[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const o = item as Record<string, unknown>;
    const id = typeof o.id === 'string' ? o.id.trim() : '';
    const name = typeof o.name === 'string' ? o.name.trim().slice(0, 48).trim() : '';
    if (!id || !name || seen.has(id)) {
      continue;
    }
    const palette = mergePartialCustomPalette(
      o.palette as Partial<BaseThemeCustomColorPalette>,
      DEFAULT_BASIC_THEME_CUSTOM_PALETTE,
    );
    const originalRaw = o.originalPalette as Partial<BaseThemeCustomColorPalette> | undefined;
    const originalPalette =
      originalRaw !== undefined && originalRaw !== null && typeof originalRaw === 'object'
        ? mergePartialCustomPalette(originalRaw, palette)
        : { ...palette };
    seen.add(id);
    out.push({ id, name, palette, originalPalette });
  }
  return out;
}

function applyFamilyDerivationIfNeeded(
  paletteId: BaseThemeColorPaletteSelectionId,
  customPalette: BaseThemeCustomColorPalette,
): BaseThemeCustomColorPalette {
  if (paletteId === 'custom' || !isBasicThemeFamilyPaletteId(paletteId)) {
    return customPalette;
  }
  const accent =
    normalizeHexColor(customPalette.accentPrimary) ?? BASIC_THEME_FAMILY_DEFAULT_ACCENTS[paletteId];
  return buildBasicFamilyCustomPalette(paletteId, accent);
}

export function normalizeBasicThemePaletteSettings(
  settings?: Partial<Record<string, unknown>>,
): BaseThemeColorPaletteSettings {
  const hasValidShape = settings && typeof settings === 'object' && !Array.isArray(settings);
  if (!hasValidShape) {
    return {
      ...DEFAULT_BASIC_THEME_CUSTOMIZATION_SETTINGS,
      customPalette: { ...DEFAULT_BASIC_THEME_CUSTOM_PALETTE },
      basicUserSavedPalettes: [],
      basicActiveUserPaletteId: null,
    };
  }

  const rawPaletteId = settings.paletteId;
  const paletteId: BaseThemeColorPaletteSelectionId =
    rawPaletteId === 'custom' || isBasicThemePaletteId(rawPaletteId)
      ? rawPaletteId
      : DEFAULT_BASIC_THEME_PALETTE;

  const basicUserSavedPalettes = sanitizeBasicUserSavedPalettes(settings.basicUserSavedPalettes);
  const defaultCustomPalette =
    paletteId === 'custom'
      ? DEFAULT_BASIC_THEME_CUSTOM_PALETTE
      : getDefaultBasicThemeCustomPalette(paletteId);
  const rawCustomPalette =
    settings && typeof settings.customPalette === 'object' && settings.customPalette !== null
      ? (settings.customPalette as Partial<BaseThemeCustomColorPalette>)
      : null;

  if (paletteId === 'custom' && !isValidFullCustomPalette(rawCustomPalette)) {
    return {
      ...DEFAULT_BASIC_THEME_CUSTOMIZATION_SETTINGS,
      customPalette: { ...DEFAULT_BASIC_THEME_CUSTOM_PALETTE },
      basicUserSavedPalettes,
      basicActiveUserPaletteId: null,
    };
  }

  const mergedCustomPalette = mergePartialCustomPalette(rawCustomPalette, defaultCustomPalette);
  const customPalette = applyFamilyDerivationIfNeeded(paletteId, mergedCustomPalette);

  let basicActiveUserPaletteId: string | null =
    typeof settings.basicActiveUserPaletteId === 'string'
      ? settings.basicActiveUserPaletteId.trim()
      : null;
  if (basicActiveUserPaletteId) {
    const hit = basicUserSavedPalettes.find((s) => s.id === basicActiveUserPaletteId);
    if (!hit || paletteId !== 'custom') {
      basicActiveUserPaletteId = null;
    }
  }

  return {
    paletteId,
    customPalette,
    basicUserSavedPalettes,
    basicActiveUserPaletteId,
  };
}
