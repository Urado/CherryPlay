export type BaseThemeColorPaletteId =
  | 'base'
  | 'nightMoss'
  | 'dustyRose'
  | 'mutedOcean'
  | 'duskAmber'
  | 'neonCyber'
  | 'voltOrange'
  | 'acidLime'
  | 'obsidian'
  | 'paperSage'
  | 'porcelainBlue'
  | 'linenBlush'
  | 'oatMilk'
  | 'arcticBerry'
  | 'limeSnow'
  | 'electricCobalt'
  | 'paperInk';

export type BaseThemeColorPaletteSelectionId = BaseThemeColorPaletteId | 'custom';

export type BaseThemeColorPalette = {
  nameRu: string;
  accentPrimary: string;
  textPrimary: string;
  backgroundPrimary: string;
  trackAreaBackground: string;
  trackBackground: string;
};

export type BaseThemeCustomColorPalette = {
  accentPrimary: string;
  textPrimary: string;
  backgroundPrimary: string;
  trackAreaBackground: string;
  trackBackground: string;
};

export type BaseThemeColorPaletteSettings = {
  paletteId: BaseThemeColorPaletteSelectionId;
  customPalette: BaseThemeCustomColorPalette;
};

export type BaseThemeColorCustomizationSettings = BaseThemeColorPaletteSettings;

export type BaseThemeColorPaletteCatalogItem = {
  id: BaseThemeColorPaletteSelectionId;
  label: string;
  palette: BaseThemeColorPalette;
  isCustom: boolean;
};

export type BaseThemeColorCanonicalCustomizationSettings = BaseThemeColorPaletteSettings;

export type BaseThemeColorLegacyFlatCustomizationSettings = {
  paletteId?: BaseThemeColorPaletteSelectionId;
  customAccentPrimary?: string;
  customTextPrimary?: string;
  customBackgroundPrimary?: string;
  customTrackAreaBackground?: string;
  customTrackBackground?: string;
};

export type BaseThemeColorCompatibilityCustomizationSettings = {
  paletteId: BaseThemeColorPaletteSelectionId;
} & Omit<BaseThemeColorLegacyFlatCustomizationSettings, 'paletteId'>;

export const BASIC_THEME_CUSTOMIZATION_OPTION_KEYS = [
  'paletteId',
  'customAccentPrimary',
  'customTextPrimary',
  'customBackgroundPrimary',
  'customTrackAreaBackground',
  'customTrackBackground',
] as const;

export const DEFAULT_BASIC_THEME_PALETTE: BaseThemeColorPaletteId = 'base';
export const ACTIVE_BASIC_THEME_PALETTE: BaseThemeColorPaletteId = DEFAULT_BASIC_THEME_PALETTE;

export const BASE_THEME_COLOR_PALETTES: Record<BaseThemeColorPaletteId, BaseThemeColorPalette> = {
  base: {
    nameRu: 'Базовый',
    accentPrimary: '#4a9eff',
    textPrimary: '#ffffff',
    backgroundPrimary: '#1a1a1a',
    trackAreaBackground: '#2a2a2a',
    trackBackground: '#333333',
  },
  nightMoss: {
    nameRu: 'Ночной мох',
    accentPrimary: '#7a9078',
    textPrimary: '#c7d0c4',
    backgroundPrimary: '#1b2420',
    trackAreaBackground: '#222b26',
    trackBackground: '#2a332e',
  },
  dustyRose: {
    nameRu: 'Пыльная роза',
    accentPrimary: '#a87a8c',
    textPrimary: '#d4c2c9',
    backgroundPrimary: '#221a1e',
    trackAreaBackground: '#2a2125',
    trackBackground: '#33282d',
  },
  mutedOcean: {
    nameRu: 'Туманный океан',
    accentPrimary: '#6c8aa3',
    textPrimary: '#c2cdd7',
    backgroundPrimary: '#17202a',
    trackAreaBackground: '#1e2833',
    trackBackground: '#26313d',
  },
  duskAmber: {
    nameRu: 'Янтарные сумерки',
    accentPrimary: '#a88966',
    textPrimary: '#cfc2b0',
    backgroundPrimary: '#211a13',
    trackAreaBackground: '#29221a',
    trackBackground: '#322a21',
  },
  neonCyber: {
    nameRu: 'Неоновый кибер',
    accentPrimary: '#ff1fd1',
    textPrimary: '#ffffff',
    backgroundPrimary: '#050508',
    trackAreaBackground: '#0c0c14',
    trackBackground: '#13131f',
  },
  voltOrange: {
    nameRu: 'Вольт-апельсин',
    accentPrimary: '#ff6a00',
    textPrimary: '#ffffff',
    backgroundPrimary: '#0a0806',
    trackAreaBackground: '#141008',
    trackBackground: '#1e170a',
  },
  acidLime: {
    nameRu: 'Кислотный лайм',
    accentPrimary: '#c8ff2a',
    textPrimary: '#fcfff5',
    backgroundPrimary: '#0b0715',
    trackAreaBackground: '#140f22',
    trackBackground: '#1d1831',
  },
  obsidian: {
    nameRu: 'Обсидиан',
    accentPrimary: '#bfbfbf',
    textPrimary: '#e8e8e8',
    backgroundPrimary: '#101010',
    trackAreaBackground: '#181818',
    trackBackground: '#222222',
  },
  paperSage: {
    nameRu: 'Бумажный шалфей',
    accentPrimary: '#7c9a6b',
    textPrimary: '#4d5e42',
    backgroundPrimary: '#f0f2ea',
    trackAreaBackground: '#e6ead9',
    trackBackground: '#d9dfc7',
  },
  porcelainBlue: {
    nameRu: 'Фарфоровая лазурь',
    accentPrimary: '#6b8aa6',
    textPrimary: '#465566',
    backgroundPrimary: '#f1f4f8',
    trackAreaBackground: '#e3e9f0',
    trackBackground: '#d2dae5',
  },
  linenBlush: {
    nameRu: 'Льняной румянец',
    accentPrimary: '#c58a95',
    textPrimary: '#5a4549',
    backgroundPrimary: '#faf2ee',
    trackAreaBackground: '#f1e6df',
    trackBackground: '#e6d6cc',
  },
  oatMilk: {
    nameRu: 'Овсяное молоко',
    accentPrimary: '#a8895e',
    textPrimary: '#54493a',
    backgroundPrimary: '#f6f1e8',
    trackAreaBackground: '#ede5d5',
    trackBackground: '#e1d6c0',
  },
  arcticBerry: {
    nameRu: 'Арктическая ягода',
    accentPrimary: '#c2006c',
    textPrimary: '#0a0612',
    backgroundPrimary: '#ffffff',
    trackAreaBackground: '#f1f1f5',
    trackBackground: '#e4e4eb',
  },
  limeSnow: {
    nameRu: 'Лаймовый снег',
    accentPrimary: '#1f6b00',
    textPrimary: '#000000',
    backgroundPrimary: '#ffffff',
    trackAreaBackground: '#eff5e7',
    trackBackground: '#dfeccb',
  },
  electricCobalt: {
    nameRu: 'Электрический кобальт',
    accentPrimary: '#0033ff',
    textPrimary: '#050a14',
    backgroundPrimary: '#ffffff',
    trackAreaBackground: '#edf1f8',
    trackBackground: '#dde5f2',
  },
  paperInk: {
    nameRu: 'Бумага и чернила',
    accentPrimary: '#6c6c6c',
    textPrimary: '#1a1a1a',
    backgroundPrimary: '#fafafa',
    trackAreaBackground: '#efefef',
    trackBackground: '#e0e0e0',
  },
};

function getDefaultBasicThemeCustomPalette(
  basePaletteId: BaseThemeColorPaletteId = DEFAULT_BASIC_THEME_PALETTE,
): BaseThemeCustomColorPalette {
  const defaultPredefined = BASE_THEME_COLOR_PALETTES[basePaletteId];

  return {
    accentPrimary: defaultPredefined.accentPrimary,
    textPrimary: defaultPredefined.textPrimary,
    backgroundPrimary: defaultPredefined.backgroundPrimary,
    trackAreaBackground: defaultPredefined.trackAreaBackground,
    trackBackground: defaultPredefined.trackBackground,
  };
}

export const DEFAULT_BASIC_THEME_CUSTOMIZATION_SETTINGS: BaseThemeColorCustomizationSettings = {
  paletteId: DEFAULT_BASIC_THEME_PALETTE,
  customPalette: getDefaultBasicThemeCustomPalette(),
};

export function getBasicThemePaletteCatalog(
  settings?: Partial<Record<string, unknown>>,
): BaseThemeColorPaletteCatalogItem[] {
  const normalized = normalizeBasicThemePaletteSettings(settings);

  const predefinedItems: BaseThemeColorPaletteCatalogItem[] = Object.entries(
    BASE_THEME_COLOR_PALETTES,
  ).map(([id, palette]) => ({
    id: id as BaseThemeColorPaletteId,
    label: palette.nameRu,
    palette,
    isCustom: false,
  }));

  const [baseItem, ...restPredefinedItems] = predefinedItems;
  return [
    ...(baseItem ? [baseItem] : []),
    {
      id: 'custom',
      label: 'Кастомная',
      palette: {
        nameRu: 'Кастомная',
        ...normalized.customPalette,
      },
      isCustom: true,
    },
    ...restPredefinedItems,
  ];
}

export function toBasicThemeCompatibilityCustomizationSettings(
  settings: BaseThemeColorCanonicalCustomizationSettings,
): BaseThemeColorCompatibilityCustomizationSettings {
  return {
    paletteId: settings.paletteId,
    customAccentPrimary: settings.customPalette.accentPrimary,
    customTextPrimary: settings.customPalette.textPrimary,
    customBackgroundPrimary: settings.customPalette.backgroundPrimary,
    customTrackAreaBackground: settings.customPalette.trackAreaBackground,
    customTrackBackground: settings.customPalette.trackBackground,
  };
}

type Rgb = { r: number; g: number; b: number };

function parseHexColor(hex: string): Rgb {
  const normalized = hex.replace('#', '');
  const value =
    normalized.length === 3
      ? normalized
          .split('')
          .map((c) => `${c}${c}`)
          .join('')
      : normalized;

  const parsed = Number.parseInt(value, 16);
  return {
    r: (parsed >> 16) & 255,
    g: (parsed >> 8) & 255,
    b: parsed & 255,
  };
}

function normalizeHexColor(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  const normalized = trimmed.startsWith('#') ? trimmed.slice(1) : trimmed;

  if (/^[\da-fA-F]{6}$/.test(normalized)) {
    return `#${normalized.toLowerCase()}`;
  }

  if (/^[\da-fA-F]{3}$/.test(normalized)) {
    const expanded = normalized
      .split('')
      .map((char) => `${char}${char}`)
      .join('');
    return `#${expanded.toLowerCase()}`;
  }

  return null;
}

function isBasicThemePaletteId(value: unknown): value is BaseThemeColorPaletteId {
  return typeof value === 'string' && value in BASE_THEME_COLOR_PALETTES;
}

function rgbToHex(rgb: Rgb): string {
  const clamp = (v: number): number => Math.max(0, Math.min(255, Math.round(v)));
  const toHex = (v: number): string => clamp(v).toString(16).padStart(2, '0');
  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
}

function mixHexColors(baseHex: string, mixHex: string, mixPercent: number): string {
  const base = parseHexColor(baseHex);
  const mix = parseHexColor(mixHex);
  const t = Math.max(0, Math.min(1, mixPercent / 100));

  return rgbToHex({
    r: base.r * (1 - t) + mix.r * t,
    g: base.g * (1 - t) + mix.g * t,
    b: base.b * (1 - t) + mix.b * t,
  });
}

function withAlpha(hex: string, alpha: number): string {
  const { r, g, b } = parseHexColor(hex);
  const a = Math.max(0, Math.min(1, alpha));
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

export function normalizeBasicThemePaletteSettings(
  settings?: Partial<Record<string, unknown>>,
): BaseThemeColorPaletteSettings {
  const rawPaletteId = settings?.paletteId;
  const paletteId: BaseThemeColorPaletteSelectionId =
    rawPaletteId === 'custom' || isBasicThemePaletteId(rawPaletteId)
      ? rawPaletteId
      : DEFAULT_BASIC_THEME_PALETTE;
  const customPaletteFallbackId = isBasicThemePaletteId(rawPaletteId)
    ? rawPaletteId
    : DEFAULT_BASIC_THEME_PALETTE;
  const defaultCustomPalette = getDefaultBasicThemeCustomPalette(customPaletteFallbackId);
  const rawCustomPalette =
    settings && typeof settings.customPalette === 'object' && settings.customPalette !== null
      ? (settings.customPalette as Partial<BaseThemeCustomColorPalette>)
      : null;

  const legacyFlat = settings as BaseThemeColorLegacyFlatCustomizationSettings | undefined;
  const customPalette: BaseThemeCustomColorPalette = {
    accentPrimary:
      normalizeHexColor(rawCustomPalette?.accentPrimary) ??
      normalizeHexColor(legacyFlat?.customAccentPrimary) ??
      defaultCustomPalette.accentPrimary,
    textPrimary:
      normalizeHexColor(rawCustomPalette?.textPrimary) ??
      normalizeHexColor(legacyFlat?.customTextPrimary) ??
      defaultCustomPalette.textPrimary,
    backgroundPrimary:
      normalizeHexColor(rawCustomPalette?.backgroundPrimary) ??
      normalizeHexColor(legacyFlat?.customBackgroundPrimary) ??
      defaultCustomPalette.backgroundPrimary,
    trackAreaBackground:
      normalizeHexColor(rawCustomPalette?.trackAreaBackground) ??
      normalizeHexColor(legacyFlat?.customTrackAreaBackground) ??
      defaultCustomPalette.trackAreaBackground,
    trackBackground:
      normalizeHexColor(rawCustomPalette?.trackBackground) ??
      normalizeHexColor(legacyFlat?.customTrackBackground) ??
      defaultCustomPalette.trackBackground,
  };

  return {
    paletteId,
    customPalette,
  };
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
      ? {
          nameRu: 'Кастомная',
          ...normalized.customPalette,
        }
      : BASE_THEME_COLOR_PALETTES[normalized.paletteId];

  return {
    ...normalized,
    palette,
  };
}

export type BasicThemeResolvedCssVars = {
  primaryColor: string;
  secondaryColor: string;
  'bg-primary': string;
  'bg-secondary': string;
  'bg-tertiary': string;
  'bg-hover': string;
  'text-primary': string;
  'text-secondary': string;
  'text-tertiary': string;
  'selected-bg': string;
  'party-info-meta-border-top': string;
  'shadow-black-15': string;
  'shadow-black-20': string;
  'shadow-black-30': string;
  'shadow-white-05': string;
};

export function resolveBasicThemeCssSettings(
  settings?: Partial<Record<string, unknown>>,
): BasicThemeResolvedCssVars {
  const resolved = resolveBasicThemePalette(settings);
  const selectedPalette = resolved.palette;
  const textPrimary = selectedPalette.textPrimary;
  const textSecondary = withAlpha(textPrimary, 0.72);
  const textTertiary = withAlpha(textPrimary, 0.5);
  const secondaryColor = mixHexColors(selectedPalette.accentPrimary, '#ffffff', 25);
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

export const BASE_THEME_SHADOW_BLACK_20 = 'rgba(0, 0, 0, 0.2)';
export const BASE_THEME_SHADOW_BLACK_15 = 'rgba(0, 0, 0, 0.15)';
export const BASE_THEME_SHADOW_BLACK_30 = 'rgba(0, 0, 0, 0.3)';
export const BASE_THEME_SHADOW_WHITE_05 = 'rgba(255, 255, 255, 0.05)';

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

// Backward-compatible aliases for existing imports.
export const BASIC_THEME_PALETTES = BASE_THEME_COLOR_PALETTES;

export type BasicThemePaletteId = BaseThemeColorPaletteId;
export type BasicThemePaletteSelectionId = BaseThemeColorPaletteSelectionId;
export type BasicThemePalette = BaseThemeColorPalette;
export type BasicThemeCustomPalette = BaseThemeCustomColorPalette;
export type BasicThemePaletteSettings = BaseThemeColorPaletteSettings;
export type BasicThemeCustomizationSettings = BaseThemeColorCustomizationSettings;
export type BasicThemePaletteCatalogItem = BaseThemeColorPaletteCatalogItem;
export type BasicThemeCanonicalCustomizationSettings = BaseThemeColorCanonicalCustomizationSettings;
export type BasicThemeLegacyFlatCustomizationSettings =
  BaseThemeColorLegacyFlatCustomizationSettings;
export type BasicThemeCompatibilityCustomizationSettings =
  BaseThemeColorCompatibilityCustomizationSettings;
