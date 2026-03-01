import type {
  PartyPlaylistData,
  PlaybackState,
  PartyThemeId,
  CustomizationSettings,
} from '@cherryplay/components';
import { isValidPartyTheme } from '@cherryplay/components';
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
  partyTitle: string | null;
  partySubtitle: string | null;
  partyId: string | null;
  themeId: PartyThemeId;
  customizationSettings: CustomizationSettings<PartyThemeId>;
  playbackState: PlaybackState | null;
  isSessionActive: boolean;
  loadPlaylist: (options?: { silent?: boolean }) => Promise<void>;
  setPlaybackState: (state: PlaybackState | null) => void;
  setIsSessionActive: (active: boolean) => void;
  setError: (error: string | null) => void;
  setThemeId: (themeId: PartyThemeId) => void;
  setCustomizationSettings: (settings: CustomizationSettings<PartyThemeId>) => void;
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
  const [themeId, setThemeId] = useState<PartyThemeId>('cyberpunk');
  const [customizationSettings, setCustomizationSettings] = useState<
    CustomizationSettings<PartyThemeId>
  >({} as CustomizationSettings<PartyThemeId>);
  const [partyName, setPartyName] = useState<string | null>(null);
  const [partyTitle, setPartyTitle] = useState<string | null>(null);
  const [partySubtitle, setPartySubtitle] = useState<string | null>(null);
  const [partyId, setPartyId] = useState<string | null>(null);
  const [playbackState, setPlaybackState] = useState<PlaybackState | null>(null);
  const [isSessionActive, setIsSessionActive] = useState(false);

  const playbackStateRef = useRef<PlaybackState | null>(null);
  const playlistRef = useRef<PartyPlaylistData | null>(null);

  /** Throttle: last playlist fetch time per party key (shortCode or 'demo'/'') */
  const lastPlaylistFetchAtRef = useRef<Record<string, number>>({});
  /** Throttle: last party info fetch time per shortCode */
  const lastPartyInfoFetchAtRef = useRef<Record<string, number>>({});
  /** Party key we are loading for; used to ignore stale responses when user switches party */
  const currentPartyKeyRef = useRef<string>('');

  useEffect(() => {
    playbackStateRef.current = playbackState;
  }, [playbackState]);

  useEffect(() => {
    playlistRef.current = playlist;
  }, [playlist]);

  const loadPlaylist = useCallback(
    async (options?: { silent?: boolean }) => {
      const silent = options?.silent === true;
      const partyKey = isDemo ? 'demo' : shortCode ?? '';

      const now = Date.now();
      const lastPlaylistAt = lastPlaylistFetchAtRef.current[partyKey] ?? 0;
      if (silent && now - lastPlaylistAt < 2000) {
        return;
      }
      lastPlaylistFetchAtRef.current[partyKey] = now;
      currentPartyKeyRef.current = partyKey;

      try {
        if (!silent) {
          setLoading(true);
          setError(null);
        }

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

          if (currentPartyKeyRef.current !== partyKey) return;

          const lastPartyInfoAt = lastPartyInfoFetchAtRef.current[shortCode] ?? 0;
          if (now - lastPartyInfoAt >= 60_000) {
            try {
              const party = await partyApiService.getPublicParty(shortCode);
              if (currentPartyKeyRef.current !== partyKey) return;
              lastPartyInfoFetchAtRef.current[shortCode] = Date.now();
              if (party.name) {
                setPartyName(party.name);
              }
              setPartyTitle(party.title ?? null);
              setPartySubtitle(party.subtitle ?? null);
              if (party.id) {
                setPartyId(party.id);
              }
              if (party.partyThemeId && isValidPartyTheme(party.partyThemeId)) {
                setThemeId(party.partyThemeId);
              }
              if (party.customizationSettings) {
                setCustomizationSettings(
                  party.customizationSettings as CustomizationSettings<PartyThemeId>,
                );
              }
            } catch (err) {
              console.warn('[usePartyState] Failed to load party info:', err);
            }
          }
        }

        if (currentPartyKeyRef.current !== partyKey) return;
        setPlaylist(playlistData);
        playlistRef.current = playlistData;
      } catch (err) {
        if (currentPartyKeyRef.current !== partyKey) return;
        const errorMessage = err instanceof Error ? err.message : 'Неизвестная ошибка при загрузке';
        setError(errorMessage);
        console.error('[usePartyState] Failed to load playlist:', err);
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [shortCode, isDemo],
  );

  useEffect(() => {
    loadPlaylist();
  }, [loadPlaylist]);

  return {
    playlist,
    loading,
    error,
    partyName,
    partyTitle,
    partySubtitle,
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
