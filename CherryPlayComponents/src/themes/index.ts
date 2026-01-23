/**
 * Theme system for CherryPlay Components
 */
import React from 'react';
import type { PartyDisplayData, PartyPlaylistData, PlaybackState, PlayerItem } from '../types';

// Импорты компонентов тем
import { PartyDisplay as CyberpunkPartyDisplay } from './cyberpunk/PartyDisplay';
import { PlaylistView as CyberpunkPlaylistView } from './cyberpunk/PlaylistView';
import { CurrentTrackDisplay as CyberpunkCurrentTrackDisplay } from './cyberpunk/CurrentTrackDisplay';

import { PartyDisplay as SakuraPartyDisplay } from './sakura/PartyDisplay';
import { PlaylistView as SakuraPlaylistView } from './sakura/PlaylistView';
import { CurrentTrackDisplay as SakuraCurrentTrackDisplay } from './sakura/CurrentTrackDisplay';

import { PartyDisplay as ArtDecoPartyDisplay } from './art-deco/PartyDisplay';
import { PlaylistView as ArtDecoPlaylistView } from './art-deco/PlaylistView';
import { CurrentTrackDisplay as ArtDecoCurrentTrackDisplay } from './art-deco/CurrentTrackDisplay';

export type ThemeId = 'cyberpunk' | 'sakura' | 'art-deco';

export interface ThemeComponents {
  PartyDisplay: React.ComponentType<{
    data: PartyDisplayData;
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
    themeId?: ThemeId;
  }>;
  CurrentTrackDisplay: React.ComponentType<{
    playbackState: PlaybackState | null;
    playlist: PartyPlaylistData | { items: PlayerItem[] };
    className?: string;
    themeId?: ThemeId;
  }>;
}

export interface Theme {
  id: ThemeId;
  name: string;
  description: string;
  cssPath: string;
  /** Опции кастомизации для темы */
  customizationOptions?: string[];
  components: ThemeComponents;
}

export interface ThemeRegistry {
  [key: string]: Theme;
}

/**
 * Регистр всех доступных тем
 * Для добавления новой темы просто добавьте запись здесь
 */
export const THEME_REGISTRY: ThemeRegistry = {
  cyberpunk: {
    id: 'cyberpunk',
    name: 'Cyberpunk',
    description: 'Неоновая тема в стиле киберпанк',
    cssPath: './cyberpunk/index.css',
    customizationOptions: ['accentColor', 'glowIntensity'],
    components: {
      PartyDisplay: CyberpunkPartyDisplay,
      PlaylistView: CyberpunkPlaylistView,
      CurrentTrackDisplay: CyberpunkCurrentTrackDisplay,
    },
  },
  sakura: {
    id: 'sakura',
    name: 'Sakura',
    description: 'Нежная пастельная тема',
    cssPath: './sakura/index.css',
    customizationOptions: ['pinkTint', 'backgroundOpacity'],
    components: {
      PartyDisplay: SakuraPartyDisplay,
      PlaylistView: SakuraPlaylistView,
      CurrentTrackDisplay: SakuraCurrentTrackDisplay,
    },
  },
  'art-deco': {
    id: 'art-deco',
    name: 'Art Deco',
    description: 'Элегантная тема в стиле ар-деко',
    cssPath: './art-deco/index.css',
    customizationOptions: ['goldColor', 'patternStyle'],
    components: {
      PartyDisplay: ArtDecoPartyDisplay,
      PlaylistView: ArtDecoPlaylistView,
      CurrentTrackDisplay: ArtDecoCurrentTrackDisplay,
    },
  },
};

/**
 * Массив всех тем (для обратной совместимости и удобства)
 */
export const themes: Theme[] = Object.values(THEME_REGISTRY);

/**
 * Получить информацию о теме по ID
 */
export function getTheme(themeId: ThemeId): Theme | undefined {
  return THEME_REGISTRY[themeId];
}

/**
 * Применить тему к элементу (установить data-theme атрибут)
 */
export function applyTheme(themeId: ThemeId, element?: HTMLElement): void {
  const target = element || document.documentElement;
  target.setAttribute('data-theme', themeId);
}

/**
 * Проверить, существует ли тема
 */
export function isValidTheme(themeId: string): themeId is ThemeId {
  return themeId in THEME_REGISTRY;
}

/**
 * Получить тему или тему по умолчанию
 */
export function getThemeOrDefault(themeId: string | undefined | null): Theme {
  if (themeId && isValidTheme(themeId)) {
    return THEME_REGISTRY[themeId];
  }
  return THEME_REGISTRY['cyberpunk'];
}

