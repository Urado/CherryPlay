/**
 * Хук для управления состоянием вечеринки
 * Объединяет данные плейлиста, состояние воспроизведения и информацию о вечеринке
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { partyApiService } from '../services/partyApiService';
import type { PartyPlaylistData, PlaybackState } from '@cherryplay/components';

export interface UsePartyStateOptions {
  shortCode?: string;
  isDemo?: boolean;
}

export interface UsePartyStateReturn {
  // Данные плейлиста
  playlist: PartyPlaylistData | null;
  loading: boolean;
  error: string | null;
  
  // Информация о вечеринке
  partyName: string | null;
  partyId: string | null;
  themeId: string;
  customizationSettings: Record<string, any>;
  
  // Состояние воспроизведения
  playbackState: PlaybackState | null;
  isSessionActive: boolean;
  
  // Методы
  loadPlaylist: () => Promise<void>;
  setPlaybackState: (state: PlaybackState | null) => void;
  setIsSessionActive: (active: boolean) => void;
  setError: (error: string | null) => void;
}

/**
 * Функция для нормализации элементов плейлиста
 */
function normalizePlaylistItems(items: any[]): any[] {
  const sorted = [...items].sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
  
  return sorted.map(item => {
    if (item.type === 'group' && item.items) {
      return {
        ...item,
        items: normalizePlaylistItems(item.items),
      };
    }
    return item;
  });
}

/**
 * Хук для управления состоянием вечеринки
 */
export function usePartyState(options: UsePartyStateOptions = {}): UsePartyStateReturn {
  const { shortCode, isDemo = false } = options;

  const [playlist, setPlaylist] = useState<PartyPlaylistData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [themeId, setThemeId] = useState<string>('cyberpunk');
  const [customizationSettings, setCustomizationSettings] = useState<Record<string, any>>({});
  const [partyName, setPartyName] = useState<string | null>(null);
  const [partyId, setPartyId] = useState<string | null>(null);
  const [playbackState, setPlaybackState] = useState<PlaybackState | null>(null);
  const [isSessionActive, setIsSessionActive] = useState(false);

  const playbackStateRef = useRef<PlaybackState | null>(null);
  const playlistRef = useRef<PartyPlaylistData | null>(null);

  // Синхронизируем ref с state
  useEffect(() => {
    playbackStateRef.current = playbackState;
  }, [playbackState]);

  useEffect(() => {
    playlistRef.current = playlist;
  }, [playlist]);

  const loadPlaylist = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let playlistData: PartyPlaylistData;

      if (isDemo || !shortCode) {
        // Демо-режим: загружаем первый плейлист
        const dto = await partyApiService.getFirstPartyPlaylist();
        playlistData = {
          items: normalizePlaylistItems(dto.items),
          totalDuration: dto.totalDuration,
          totalTracks: dto.totalTracks,
        };
      } else {
        // Режим с shortCode: загружаем плейлист по коду
        const dto = await partyApiService.getPartyPlaylist(shortCode);
        playlistData = {
          items: normalizePlaylistItems(dto.items),
          totalDuration: dto.totalDuration,
          totalTracks: dto.totalTracks,
        };

        // Получаем информацию о вечеринке для стиля и названия
        try {
          const party = await partyApiService.getPublicParty(shortCode);
          if (party.name) {
            setPartyName(party.name);
          }
          if (party.id) {
            setPartyId(party.id);
          }
          if (party.themeId && ['cyberpunk', 'sakura', 'art-deco'].includes(party.themeId)) {
            setThemeId(party.themeId);
          }
          if (party.customizationSettings) {
            setCustomizationSettings(party.customizationSettings);
          }
        } catch (err) {
          // Игнорируем ошибку, используем дефолтный стиль
          console.warn('[usePartyState] Failed to load party info:', err);
        }
      }

      setPlaylist(playlistData);
      playlistRef.current = playlistData;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Неизвестная ошибка при загрузке';
      setError(errorMessage);
      console.error('[usePartyState] Failed to load playlist:', err);
    } finally {
      setLoading(false);
    }
  }, [shortCode, isDemo]);

  // Загружаем плейлист при монтировании или изменении shortCode
  useEffect(() => {
    loadPlaylist();
  }, [loadPlaylist]);

  return {
    playlist,
    loading,
    error,
    partyName,
    partyId,
    themeId,
    customizationSettings,
    playbackState,
    isSessionActive,
    loadPlaylist,
    setPlaybackState,
    setIsSessionActive,
    setError,
  };
}
