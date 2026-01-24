import type { ThemeId } from './index';

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
  id: ThemeId;
  defaultCustomizationSettings: Record<string, string | number>;
  customizationOptions: ThemeCustomizationOption[];
}

export type CyberpunkCustomizationSettings = {
  accentColor: string;
  glowIntensity: number;
};

export type SakuraCustomizationSettings = {
  pinkTint: string;
  backgroundOpacity: number;
};

export type ArtDecoCustomizationSettings = {
  goldColor: string;
  patternStyle: 'geometric' | 'floral' | 'linear';
};

export type BasicCustomizationSettings = Record<string, never>;

export type ThemeCustomizationSettingsMap = {
  cyberpunk: CyberpunkCustomizationSettings;
  sakura: SakuraCustomizationSettings;
  'art-deco': ArtDecoCustomizationSettings;
  basic: BasicCustomizationSettings;
};

export type CustomizationSettings<T extends ThemeId = ThemeId> = ThemeCustomizationSettingsMap[T];

export const THEME_METADATA: Record<ThemeId, ThemeMetadata> = {
  cyberpunk: {
    id: 'cyberpunk',
    defaultCustomizationSettings: {
      accentColor: '#00ff00',
      glowIntensity: 50,
    },
    customizationOptions: [
      {
        key: 'accentColor',
        type: 'color',
        defaultValue: '#00ff00',
        label: 'Цвет акцента',
      },
      {
        key: 'glowIntensity',
        type: 'number',
        defaultValue: 50,
        min: 0,
        max: 100,
        step: 1,
        transform: (value) => String(Math.max(0, Math.min(1, Number(value) / 100))),
        label: 'Интенсивность свечения',
        description: 'Интенсивность свечения от 0 до 100',
      },
    ],
  },
  sakura: {
    id: 'sakura',
    defaultCustomizationSettings: {
      pinkTint: '#ffb3d9',
      backgroundOpacity: 80,
    },
    customizationOptions: [
      {
        key: 'pinkTint',
        type: 'color',
        defaultValue: '#ffb3d9',
        label: 'Оттенок розового',
      },
      {
        key: 'backgroundOpacity',
        type: 'number',
        defaultValue: 80,
        min: 0,
        max: 100,
        step: 1,
        transform: (value) => String(Math.max(0, Math.min(1, Number(value) / 100))),
        label: 'Прозрачность фона',
        description: 'Прозрачность фона от 0 до 100',
      },
    ],
  },
  'art-deco': {
    id: 'art-deco',
    defaultCustomizationSettings: {
      goldColor: '#d4af37',
      patternStyle: 'geometric',
    },
    customizationOptions: [
      {
        key: 'goldColor',
        type: 'color',
        defaultValue: '#d4af37',
        label: 'Цвет золота',
      },
      {
        key: 'patternStyle',
        type: 'select',
        defaultValue: 'geometric',
        label: 'Стиль паттерна',
        options: [
          { value: 'geometric', label: 'Геометрический' },
          { value: 'floral', label: 'Цветочный' },
          { value: 'linear', label: 'Линейный' },
        ],
      },
    ],
  },
  basic: {
    id: 'basic',
    defaultCustomizationSettings: {},
    customizationOptions: [],
  },
};

export function getThemeMetadata(themeId: ThemeId): ThemeMetadata {
  return THEME_METADATA[themeId];
}

export function getDefaultCustomizationSettings<T extends ThemeId>(
  themeId: T
): ThemeCustomizationSettingsMap[T] {
  const metadata = THEME_METADATA[themeId];
  return metadata.defaultCustomizationSettings as ThemeCustomizationSettingsMap[T];
}

export function getCustomizationOption(
  themeId: ThemeId,
  optionKey: string
): ThemeCustomizationOption | undefined {
  const metadata = THEME_METADATA[themeId];
  return metadata.customizationOptions.find((opt) => opt.key === optionKey);
}
