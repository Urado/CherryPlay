import React from 'react';

import type { PartyDisplayData, PartyPlaylistData, PlaybackState, PlayerItem } from '../types';

import { ArtDecoThemeCustomizationEditor } from './art-deco/CustomizationEditor';
import {
  PartyDisplay as BasePartyDisplay,
  PlaylistView as BasePlaylistView,
  CurrentTrackDisplay as BaseCurrentTrackDisplay,
  PartyInfoDisplay as BasePartyInfoDisplay,
  BASIC_THEME_CUSTOMIZATION_OPTION_KEYS,
} from './base';
import { BasicThemeCustomizationEditor } from './basic';
import { CyberpunkThemeCustomizationEditor } from './cyberpunk/CustomizationEditor';
import { SakuraThemeCustomizationEditor } from './sakura/CustomizationEditor';
import {
  PartyDisplay as SpringCrossStepPartyDisplay,
  PlaylistView as SpringCrossStepPlaylistView,
  CurrentTrackDisplay as SpringCrossStepCurrentTrackDisplay,
  PartyInfoDisplay as SpringCrossStepPartyInfoDisplay,
} from './spring-cross-step';
import { SpringCrossStepThemeCustomizationEditor } from './spring-cross-step/CustomizationEditor';

export type PartyThemeId = 'cyberpunk' | 'sakura' | 'art-deco' | 'basic' | 'spring-cross-step';

export interface PartyThemeComponents {
  PartyDisplay: React.ComponentType<{
    data: PartyDisplayData<PartyThemeId>;
    className?: string;
    showPlayer?: boolean;
  }>;
  PlaylistView: React.ComponentType<{
    playlist: PartyPlaylistData;
    currentTrackId?: string | null;
    playedTrackIds?: string[];
    disabledTrackIds?: string[];
    disabledGroupIds?: string[];
    isSessionActive?: boolean;
    className?: string;
    themeId?: string;
  }>;
  CurrentTrackDisplay: React.ComponentType<{
    playbackState: PlaybackState | null;
    playlist: PartyPlaylistData | { items: PlayerItem[] };
    className?: string;
    themeId?: string;
  }>;
  PartyInfoDisplay: React.ComponentType<{
    data: import('./base').PartyInfoDisplayData;
    className?: string;
  }>;
  CustomizationEditor?: React.ComponentType<ThemeCustomizationEditorProps>;
}

export interface ThemeCustomizationEditorProps {
  customizationSettings: Record<string, unknown>;
  onCustomizationSettingsChange: (settings: Record<string, unknown>) => void;
}

export interface PartyTheme {
  id: PartyThemeId;
  name: string;
  description: string;
  cssPath: string;
  customizationOptions?: string[];
  components: PartyThemeComponents;
}

export interface PartyThemeRegistry {
  [key: string]: PartyTheme;
}

export const BASE_COMPONENTS: PartyThemeComponents = {
  PartyDisplay: BasePartyDisplay,
  PlaylistView: BasePlaylistView,
  CurrentTrackDisplay: BaseCurrentTrackDisplay,
  PartyInfoDisplay: BasePartyInfoDisplay,
};

export interface CreatePartyThemeConfig {
  id: PartyThemeId;
  name: string;
  description: string;
  cssPath: string;
  customizationOptions?: string[];
  overrides?: Partial<PartyThemeComponents>;
}

export function createPartyTheme(config: CreatePartyThemeConfig): PartyTheme {
  return {
    id: config.id,
    name: config.name,
    description: config.description,
    cssPath: config.cssPath,
    customizationOptions: config.customizationOptions,
    components: {
      ...BASE_COMPONENTS,
      ...config.overrides,
    },
  };
}

export const PARTY_THEME_REGISTRY: PartyThemeRegistry = {
  cyberpunk: createPartyTheme({
    id: 'cyberpunk',
    name: 'Cyberpunk',
    description: 'Неоновая тема в стиле киберпанк',
    cssPath: './cyberpunk/index.css',
    customizationOptions: [],
    overrides: {
      CustomizationEditor: CyberpunkThemeCustomizationEditor,
    },
  }),
  sakura: createPartyTheme({
    id: 'sakura',
    name: 'Sakura',
    description: 'Нежная пастельная тема',
    cssPath: './sakura/index.css',
    customizationOptions: [],
    overrides: {
      CustomizationEditor: SakuraThemeCustomizationEditor,
    },
  }),
  'art-deco': createPartyTheme({
    id: 'art-deco',
    name: 'Art Deco',
    description: 'Элегантная тема в стиле ар-деко',
    cssPath: './art-deco/index.css',
    customizationOptions: [],
    overrides: {
      CustomizationEditor: ArtDecoThemeCustomizationEditor,
    },
  }),
  basic: createPartyTheme({
    id: 'basic',
    name: 'Базовый',
    description: 'Простой и чистый стиль в духе приложения',
    cssPath: './basic/index.css',
    customizationOptions: [...BASIC_THEME_CUSTOMIZATION_OPTION_KEYS],
    overrides: {
      CustomizationEditor: BasicThemeCustomizationEditor,
    },
  }),
  'spring-cross-step': createPartyTheme({
    id: 'spring-cross-step',
    name: 'Весенний кросс-степ',
    description: 'Светлая весенняя тема с зелёными акцентами и мягкими тонами',
    cssPath: './spring-cross-step/index.css',
    customizationOptions: [],
    overrides: {
      PartyDisplay: SpringCrossStepPartyDisplay,
      PlaylistView: SpringCrossStepPlaylistView,
      CurrentTrackDisplay: SpringCrossStepCurrentTrackDisplay,
      PartyInfoDisplay: SpringCrossStepPartyInfoDisplay,
      CustomizationEditor: SpringCrossStepThemeCustomizationEditor,
    },
  }),
};

export const partyThemes: PartyTheme[] = Object.values(PARTY_THEME_REGISTRY);

export function getPartyTheme(partyThemeId: PartyThemeId): PartyTheme | undefined {
  return PARTY_THEME_REGISTRY[partyThemeId];
}

export function applyPartyTheme(partyThemeId: PartyThemeId, element?: HTMLElement): void {
  const target = element || document.documentElement;
  target.setAttribute('data-theme', partyThemeId);
}

export function isValidPartyTheme(partyThemeId: string): partyThemeId is PartyThemeId {
  return partyThemeId in PARTY_THEME_REGISTRY;
}

export function getPartyThemeOrDefault(partyThemeId: string | undefined | null): PartyTheme {
  if (partyThemeId && isValidPartyTheme(partyThemeId)) {
    return PARTY_THEME_REGISTRY[partyThemeId];
  }
  return PARTY_THEME_REGISTRY['cyberpunk'];
}

export {
  getThemeMetadata,
  getDefaultCustomizationSettings,
  getCustomizationOption,
  type ThemeMetadata,
  type ThemeCustomizationOption,
  type CustomizationOptionType,
  type SelectOption,
  type ThemeCustomizationSettingsMap,
  type CustomizationSettings,
  type CyberpunkCustomizationSettings,
  type SakuraCustomizationSettings,
  type ArtDecoCustomizationSettings,
  type BasicCustomizationSettings,
  type BasicCustomizationOptionSettings,
  type SpringCrossStepCustomizationSettings,
} from './themeMetadata';

export {
  BASIC_THEME_CUSTOMIZATION_OPTION_KEYS,
  getBasicThemePaletteCatalog,
  normalizeBasicThemePaletteSettings,
  resolveBasicThemePalette,
  resolveBasicThemeCssSettings,
} from './base';
export type {
  BaseThemeColorPaletteCatalogItem,
  BaseThemeColorPaletteId,
  BaseThemeColorPaletteSelectionId,
  BaseThemeColorPaletteSettings,
  BaseThemeColorCustomizationSettings,
  BaseThemeCustomColorPalette,
  BasicThemePaletteCatalogItem,
  BasicThemePaletteId,
  BasicThemePaletteSelectionId,
  BasicThemePaletteSettings,
  BasicThemeCustomizationSettings,
  BasicThemeCustomPalette,
} from './base';
