import {
  BASE_THEME_COLOR_PALETTES,
  DEFAULT_BASIC_THEME_CUSTOMIZATION_SETTINGS,
  getBasicThemePaletteCatalog,
  normalizeBasicThemePaletteSettings,
  type BaseThemeColorCustomizationSettings,
} from './basic/palette';
import type { PartyThemeId } from './partyThemeTypes';

export type CustomizationOptionType = 'color' | 'number' | 'text' | 'select';

export interface SelectOption {
  value: string;
  label: string;
}

export interface ThemeCustomizationOption {
  key: string;
  type: CustomizationOptionType;
  defaultValue: string | number;
  label: string;
  description?: string;
  min?: number;
  max?: number;
  step?: number;
  options?: SelectOption[];
  transform?: (value: string | number) => string;
}

export interface ThemeMetadata {
  id: PartyThemeId;
  defaultCustomizationSettings: Record<string, unknown>;
  customizationOptions: ThemeCustomizationOption[];
}

export type CyberpunkCustomizationSettings = Record<string, never>;

export type SakuraCustomizationSettings = Record<string, never>;

export type ArtDecoCustomizationSettings = Record<string, never>;

// Canonical storage contract for basic theme settings.
export type BasicCustomizationSettings = BaseThemeColorCustomizationSettings;

// Option metadata uses the same canonical settings contract.
export type BasicCustomizationOptionSettings = BaseThemeColorCustomizationSettings;

export type SpringCrossStepCustomizationSettings = Record<string, never>;

export type ThemeCustomizationSettingsMap = {
  cyberpunk: CyberpunkCustomizationSettings;
  sakura: SakuraCustomizationSettings;
  'art-deco': ArtDecoCustomizationSettings;
  basic: BasicCustomizationSettings;
  'spring-cross-step': SpringCrossStepCustomizationSettings;
};

export type CustomizationSettings<T extends PartyThemeId = PartyThemeId> =
  ThemeCustomizationSettingsMap[T];

function createBasicThemeCustomizationOptions(
  settings?: Partial<Record<string, unknown>>,
): ThemeCustomizationOption[] {
  const normalized = normalizeBasicThemePaletteSettings(settings);

  const catalogSelectOptions = getBasicThemePaletteCatalog(settings).map((palette) => ({
    value: palette.id,
    label: palette.label,
  }));
  /** `base` не входит в визуальный каталог плиток, но остаётся валидным `paletteId` и дефолтом при fallback. */
  const paletteIdOptions = catalogSelectOptions.some((o) => o.value === 'base')
    ? catalogSelectOptions
    : [{ value: 'base', label: BASE_THEME_COLOR_PALETTES.base.nameRu }, ...catalogSelectOptions];

  return [
    {
      key: 'paletteId',
      type: 'select',
      defaultValue: normalized.paletteId,
      label: 'Палитра',
      options: paletteIdOptions,
    },
    {
      key: 'customPalette.accentPrimary',
      type: 'color',
      defaultValue: normalized.customPalette.accentPrimary,
      label: 'Кастом: основной акцент',
    },
    {
      key: 'customPalette.textPrimary',
      type: 'color',
      defaultValue: normalized.customPalette.textPrimary,
      label: 'Кастом: основной текст',
    },
    {
      key: 'customPalette.backgroundPrimary',
      type: 'color',
      defaultValue: normalized.customPalette.backgroundPrimary,
      label: 'Кастом: фон',
    },
    {
      key: 'customPalette.trackAreaBackground',
      type: 'color',
      defaultValue: normalized.customPalette.trackAreaBackground,
      label: 'Кастом: фон списка',
    },
    {
      key: 'customPalette.trackBackground',
      type: 'color',
      defaultValue: normalized.customPalette.trackBackground,
      label: 'Кастом: фон трека',
    },
  ];
}

/** Снимок метаданных при загрузке модуля. Для `basic` актуальные опции/defaultValue — через `getThemeMetadata('basic', settings)`. */
export const THEME_METADATA: Record<PartyThemeId, ThemeMetadata> = {
  cyberpunk: {
    id: 'cyberpunk',
    defaultCustomizationSettings: {},
    customizationOptions: [],
  },
  sakura: {
    id: 'sakura',
    defaultCustomizationSettings: {},
    customizationOptions: [],
  },
  'art-deco': {
    id: 'art-deco',
    defaultCustomizationSettings: {},
    customizationOptions: [],
  },
  basic: {
    id: 'basic',
    defaultCustomizationSettings: DEFAULT_BASIC_THEME_CUSTOMIZATION_SETTINGS,
    customizationOptions: createBasicThemeCustomizationOptions(),
  },
  'spring-cross-step': {
    id: 'spring-cross-step',
    defaultCustomizationSettings: {},
    customizationOptions: [],
  },
};

// Dynamic form usage: pass current `customizationSettings` to get live default values
// for basic custom colors and custom-palette preview option.
// Static usage (docs, schema listing): call without runtime settings.
export function getThemeMetadata(
  partyThemeId: PartyThemeId,
  customizationSettings?: Partial<Record<string, unknown>>,
): ThemeMetadata {
  const metadata = THEME_METADATA[partyThemeId];

  if (partyThemeId !== 'basic') {
    return metadata;
  }

  return {
    ...metadata,
    customizationOptions: createBasicThemeCustomizationOptions(customizationSettings),
  };
}

export function getDefaultCustomizationSettings<T extends PartyThemeId>(
  partyThemeId: T,
): ThemeCustomizationSettingsMap[T] {
  const metadata = THEME_METADATA[partyThemeId];
  return metadata.defaultCustomizationSettings as ThemeCustomizationSettingsMap[T];
}

export function getCustomizationOption(
  partyThemeId: PartyThemeId,
  optionKey: string,
  customizationSettings?: Partial<Record<string, unknown>>,
): ThemeCustomizationOption | undefined {
  const metadata = getThemeMetadata(partyThemeId, customizationSettings);
  return metadata.customizationOptions.find((opt) => opt.key === optionKey);
}
