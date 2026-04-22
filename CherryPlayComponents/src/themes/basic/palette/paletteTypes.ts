export type BaseThemeColorPaletteId =
  | 'base'
  | 'darkGradient'
  | 'lightGradient'
  | 'darkNeon'
  | 'lightAccent';

export type BaseThemeFamilyPaletteId =
  | 'darkGradient'
  | 'lightGradient'
  | 'darkNeon'
  | 'lightAccent';

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

export type BaseThemeUserSavedPalette = {
  id: string;
  name: string;
  palette: BaseThemeCustomColorPalette;
  originalPalette: BaseThemeCustomColorPalette;
};

export type BaseThemeColorPaletteSettings = {
  paletteId: BaseThemeColorPaletteSelectionId;
  customPalette: BaseThemeCustomColorPalette;
  basicUserSavedPalettes?: BaseThemeUserSavedPalette[];
  basicActiveUserPaletteId?: string | null;
};

export type BaseThemeColorCustomizationSettings = BaseThemeColorPaletteSettings;

export type BaseThemeColorPaletteCatalogItem = {
  id: string;
  label: string;
  palette: BaseThemeColorPalette;
  isCustom: boolean;
  userSavedId?: string;
};

export type BaseThemeResolvedCssVars = {
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
