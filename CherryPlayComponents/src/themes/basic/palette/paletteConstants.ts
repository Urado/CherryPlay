import type { BaseThemeCustomColorPalette, BaseThemeFamilyPaletteId } from './paletteTypes';

export const BASIC_THEME_FAMILY_IDS: readonly BaseThemeFamilyPaletteId[] = [
  'darkGradient',
  'lightGradient',
  'darkNeon',
  'lightAccent',
];

export const BASIC_THEME_CUSTOMIZATION_OPTION_KEYS = [
  'paletteId',
  'customPalette',
  'basicUserSavedPalettes',
  'basicActiveUserPaletteId',
] as const;

export const BASIC_THEME_USER_SAVED_CATALOG_PREFIX = 'userSaved:';
export const BASIC_THEME_MANUAL_PALETTE_LABEL = 'Ручная настройка';

export const DEFAULT_BASIC_THEME_PALETTE = 'base' as const;
export const ACTIVE_BASIC_THEME_PALETTE = DEFAULT_BASIC_THEME_PALETTE;

export const DEFAULT_BASIC_THEME_CUSTOM_PALETTE: BaseThemeCustomColorPalette = {
  accentPrimary: '#4a9eff',
  textPrimary: '#ffffff',
  backgroundPrimary: '#1a1a1a',
  trackAreaBackground: '#2a2a2a',
  trackBackground: '#333333',
};

export const DEFAULT_BASIC_THEME_ACCENT = DEFAULT_BASIC_THEME_CUSTOM_PALETTE.accentPrimary;

export const BASIC_THEME_DARK_GRADIENT_PRESETS = [
  { id: 'nightMoss', label: 'Ночной мох', accent: '#7a9078' },
  { id: 'dustyRose', label: 'Пыльная роза', accent: '#a87a8c' },
  { id: 'mutedOcean', label: 'Туманный океан', accent: '#6c8aa3' },
  { id: 'duskAmber', label: 'Янтарные сумерки', accent: '#a88966' },
  { id: 'wineStone', label: 'Брусника', accent: '#8b4a5c' },
  { id: 'indigoDeep', label: 'Индиго в ночи', accent: '#4a5f8f' },
  { id: 'slateGray', label: 'Пепельный сланец', accent: '#90979e' },
] as const;

export const BASIC_THEME_LIGHT_GRADIENT_PRESETS = [
  { id: 'paperSage', label: 'Бумажный шалфей', accent: '#7c9a6b' },
  { id: 'porcelainBlue', label: 'Фарфоровая глазурь', accent: '#5f7eb8' },
  { id: 'linenBlush', label: 'Льняной румянец', accent: '#c58a95' },
  { id: 'electricCobalt', label: 'Электрический кобальт', accent: '#0033ff' },
  { id: 'limeSnow', label: 'Лаймовый снег', accent: '#1f6b00' },
  { id: 'honeyAmber', label: 'Мёд и янтарь', accent: '#c48a2c' },
  { id: 'cloudGray', label: 'Облачный серый', accent: '#78716c' },
] as const;

export const BASIC_THEME_DARK_NEON_PRESETS = [
  { id: 'neonCyber', label: 'Неоновый кибер', accent: '#ff1fd1' },
  { id: 'voltOrange', label: 'Вольт-апельсин', accent: '#ff6a00' },
  { id: 'acidLime', label: 'Кислотный лайм', accent: '#c8ff2a' },
  { id: 'aquaSpike', label: 'Лазурный шип', accent: '#00f0ff' },
  { id: 'violetArc', label: 'Фиолетовая дуга', accent: '#c84dff' },
  { id: 'mintRelay', label: 'Мятное реле', accent: '#39ff9d' },
  { id: 'steelPulse', label: 'Серый импульс', accent: '#b8c0cc' },
] as const;

export const BASIC_THEME_LIGHT_ACCENT_PRESETS = [
  { id: 'arcticBerry', label: 'Арктическая ягода', accent: '#c2006c' },
  { id: 'tealInk', label: 'Бирюзовые чернила', accent: '#006370' },
  { id: 'indigoStamp', label: 'Индиго-печать', accent: '#3949ab' },
  { id: 'leafMark', label: 'Листья бамбука', accent: '#2e7d32' },
  { id: 'copperSeal', label: 'Медная печать', accent: '#b87333' },
  { id: 'orchidInk', label: 'Орхидея', accent: '#7b2cbf' },
  { id: 'graphiteNote', label: 'Графитовая заметка', accent: '#6c6c6c' },
] as const;

export const BASIC_THEME_FAMILY_DEFAULT_ACCENTS: Record<BaseThemeFamilyPaletteId, string> = {
  darkGradient: BASIC_THEME_DARK_GRADIENT_PRESETS[0].accent,
  lightGradient: BASIC_THEME_LIGHT_GRADIENT_PRESETS[0].accent,
  darkNeon: BASIC_THEME_DARK_NEON_PRESETS[0].accent,
  lightAccent: BASIC_THEME_LIGHT_ACCENT_PRESETS[0].accent,
};

export const BASIC_THEME_CATALOG_ORDER = [
  'darkGradient',
  'lightGradient',
  'darkNeon',
  'lightAccent',
] as const;
