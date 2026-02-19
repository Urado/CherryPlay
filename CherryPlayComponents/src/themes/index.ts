import React from 'react';

import type { PartyDisplayData, PartyPlaylistData, PlaybackState, PlayerItem } from '../types';

import {
  PartyDisplay as BasePartyDisplay,
  PlaylistView as BasePlaylistView,
  CurrentTrackDisplay as BaseCurrentTrackDisplay,
  PartyInfoDisplay as BasePartyInfoDisplay,
} from './base';

export type ThemeId = 'cyberpunk' | 'sakura' | 'art-deco' | 'basic';

export interface ThemeComponents {
  PartyDisplay: React.ComponentType<{
    data: PartyDisplayData<ThemeId>;
    className?: string;
    showPlayer?: boolean;
  }>;
  PlaylistView: React.ComponentType<{
    playlist: PartyPlaylistData;
    currentTrackId?: string | null;
    playedTrackIds?: string[];
    disabledTrackIds?: string[];
    disabledGroupIds?: string[];
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
    onGoToPlaylist?: () => void;
    onGoToCatalog?: () => void;
  }>;
}

export interface Theme {
  id: ThemeId;
  name: string;
  description: string;
  cssPath: string;
  customizationOptions?: string[];
  components: ThemeComponents;
}

export interface ThemeRegistry {
  [key: string]: Theme;
}

export const BASE_COMPONENTS: ThemeComponents = {
  PartyDisplay: BasePartyDisplay,
  PlaylistView: BasePlaylistView,
  CurrentTrackDisplay: BaseCurrentTrackDisplay,
  PartyInfoDisplay: BasePartyInfoDisplay,
};

export interface CreateThemeConfig {
  id: ThemeId;
  name: string;
  description: string;
  cssPath: string;
  customizationOptions?: string[];
  overrides?: Partial<ThemeComponents>;
}

export function createTheme(config: CreateThemeConfig): Theme {
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

export const THEME_REGISTRY: ThemeRegistry = {
  cyberpunk: createTheme({
    id: 'cyberpunk',
    name: 'Cyberpunk',
    description: 'Неоновая тема в стиле киберпанк',
    cssPath: './cyberpunk/index.css',
    customizationOptions: ['accentColor', 'glowIntensity'],
  }),
  sakura: createTheme({
    id: 'sakura',
    name: 'Sakura',
    description: 'Нежная пастельная тема',
    cssPath: './sakura/index.css',
    customizationOptions: ['pinkTint', 'backgroundOpacity'],
  }),
  'art-deco': createTheme({
    id: 'art-deco',
    name: 'Art Deco',
    description: 'Элегантная тема в стиле ар-деко',
    cssPath: './art-deco/index.css',
    customizationOptions: ['goldColor', 'patternStyle'],
  }),
  basic: createTheme({
    id: 'basic',
    name: 'Базовый',
    description: 'Простой и чистый стиль в духе приложения',
    cssPath: './basic/index.css',
  }),
};

export const themes: Theme[] = Object.values(THEME_REGISTRY);

export function getTheme(themeId: ThemeId): Theme | undefined {
  return THEME_REGISTRY[themeId];
}

export function applyTheme(themeId: ThemeId, element?: HTMLElement): void {
  const target = element || document.documentElement;
  target.setAttribute('data-theme', themeId);
}

export function isValidTheme(themeId: string): themeId is ThemeId {
  return themeId in THEME_REGISTRY;
}

export function getThemeOrDefault(themeId: string | undefined | null): Theme {
  if (themeId && isValidTheme(themeId)) {
    return THEME_REGISTRY[themeId];
  }
  return THEME_REGISTRY['cyberpunk'];
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
} from './themeMetadata';
