import type { BaseThemeColorPalette, BaseThemeCustomColorPalette } from './paletteTypes';

const BLACK = '#000000';
const WHITE = '#ffffff';

type Rgb = { r: number; g: number; b: number };

export function normalizeHexColor(value: unknown): string | null {
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

function rgbToHex(rgb: Rgb): string {
  const clamp = (v: number): number => Math.max(0, Math.min(255, Math.round(v)));
  const toHex = (v: number): string => clamp(v).toString(16).padStart(2, '0');
  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
}

export function mixHexColors(baseHex: string, mixHex: string, mixPercent: number): string {
  const base = parseHexColor(baseHex);
  const mix = parseHexColor(mixHex);
  const t = Math.max(0, Math.min(1, mixPercent / 100));

  return rgbToHex({
    r: base.r * (1 - t) + mix.r * t,
    g: base.g * (1 - t) + mix.g * t,
    b: base.b * (1 - t) + mix.b * t,
  });
}

export function mixTowardBlack(hex: string, percent: number): string {
  return mixHexColors(hex, BLACK, percent);
}

export function mixTowardWhite(hex: string, percent: number): string {
  return mixHexColors(hex, WHITE, percent);
}

export function withAlpha(hex: string, alpha: number): string {
  const { r, g, b } = parseHexColor(hex);
  const a = Math.max(0, Math.min(1, alpha));
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

export function paletteToCustom(palette: BaseThemeColorPalette): BaseThemeCustomColorPalette {
  return {
    accentPrimary: palette.accentPrimary,
    textPrimary: palette.textPrimary,
    backgroundPrimary: palette.backgroundPrimary,
    trackAreaBackground: palette.trackAreaBackground,
    trackBackground: palette.trackBackground,
  };
}

export function mergePartialCustomPalette(
  partial: Partial<BaseThemeCustomColorPalette> | null | undefined,
  fallback: BaseThemeCustomColorPalette,
): BaseThemeCustomColorPalette {
  return {
    accentPrimary: normalizeHexColor(partial?.accentPrimary) ?? fallback.accentPrimary,
    textPrimary: normalizeHexColor(partial?.textPrimary) ?? fallback.textPrimary,
    backgroundPrimary: normalizeHexColor(partial?.backgroundPrimary) ?? fallback.backgroundPrimary,
    trackAreaBackground:
      normalizeHexColor(partial?.trackAreaBackground) ?? fallback.trackAreaBackground,
    trackBackground: normalizeHexColor(partial?.trackBackground) ?? fallback.trackBackground,
  };
}

export function isValidFullCustomPalette(
  value: Partial<BaseThemeCustomColorPalette> | null | undefined,
): value is BaseThemeCustomColorPalette {
  return Boolean(
    normalizeHexColor(value?.accentPrimary) &&
    normalizeHexColor(value?.textPrimary) &&
    normalizeHexColor(value?.backgroundPrimary) &&
    normalizeHexColor(value?.trackAreaBackground) &&
    normalizeHexColor(value?.trackBackground),
  );
}

export function areBasicCustomPalettesEqual(
  a: BaseThemeCustomColorPalette,
  b: BaseThemeCustomColorPalette,
): boolean {
  return (
    a.accentPrimary === b.accentPrimary &&
    a.textPrimary === b.textPrimary &&
    a.backgroundPrimary === b.backgroundPrimary &&
    a.trackAreaBackground === b.trackAreaBackground &&
    a.trackBackground === b.trackBackground
  );
}
