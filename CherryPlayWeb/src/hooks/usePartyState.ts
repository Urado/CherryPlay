import type {
  PartyPlaylistData,
  PlaybackState,
  ThemeId,
  CustomizationSettings,
} from '@cherryplay/components';
import { isValidTheme } from '@cherryplay/components';
import { useState, useCallback, useRef, useEffect } from 'react';

import { partyApiService } from '../services/partyApiService';
import type { PlayerItemDto } from '../types/api';

export interface UsePartyStateOptions {
  shortCode?: string;
  isDemo?: boolean;
}

export interface UsePartyStateReturn {
  playlist: PartyPlaylistData | null;
  loading: boolean;
  error: string | null;
  partyName: string | null;
  partyId: string | null;
  themeId: ThemeId;
  customizationSettings: CustomizationSettings<ThemeId>;
  playbackState: PlaybackState | null;
  isSessionActive: boolean;
  loadPlaylist: () => Promise<void>;
  setPlaybackState: (state: PlaybackState | null) => void;
  setIsSessionActive: (active: boolean) => void;
  setError: (error: string | null) => void;
  setThemeId: (themeId: ThemeId) => void;
  setCustomizationSettings: (settings: CustomizationSettings<ThemeId>) => void;
  setPartyName: (name: string | null) => void;
}

function normalizePlaylistItems(items: PlayerItemDto[]): PlayerItemDto[] {
  const sorted = [...items].sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));

  return sorted.map((item) => {
    if (item.type === 'group' && item.items) {
      return {
        ...item,
        items: normalizePlaylistItems(item.items),
      };
    }
    return item;
  });
}

export function usePartyState(options: UsePartyStateOptions = {}): UsePartyStateReturn {
  const { shortCode, isDemo = false } = options;

  const [playlist, setPlaylist] = useState<PartyPlaylistData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [themeId, setThemeId] = useState<ThemeId>('cyberpunk');
  const [customizationSettings, setCustomizationSettings] = useState<
    CustomizationSettings<ThemeId>
  >({} as CustomizationSettings<ThemeId>);
  const [partyName, setPartyName] = useState<string | null>(null);
  const [partyId, setPartyId] = useState<string | null>(null);
  const [playbackState, setPlaybackState] = useState<PlaybackState | null>(null);
  const [isSessionActive, setIsSessionActive] = useState(false);

  const playbackStateRef = useRef<PlaybackState | null>(null);
  const playlistRef = useRef<PartyPlaylistData | null>(null);

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
        const dto = await partyApiService.getFirstPartyPlaylist();
        playlistData = {
          items: normalizePlaylistItems(dto.items),
          totalDuration: dto.totalDuration,
          totalTracks: dto.totalTracks,
        };
      } else {
        const dto = await partyApiService.getPartyPlaylist(shortCode);
        playlistData = {
          items: normalizePlaylistItems(dto.items),
          totalDuration: dto.totalDuration,
          totalTracks: dto.totalTracks,
        };

        try {
          const party = await partyApiService.getPublicParty(shortCode);
          if (party.name) {
            setPartyName(party.name);
          }
          if (party.id) {
            setPartyId(party.id);
          }
          if (party.themeId && isValidTheme(party.themeId)) {
            setThemeId(party.themeId);
          }
          if (party.customizationSettings) {
            setCustomizationSettings(party.customizationSettings as CustomizationSettings<ThemeId>);
          }
        } catch (err) {
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
    setThemeId,
    setCustomizationSettings,
    setPartyName,
  };
}
