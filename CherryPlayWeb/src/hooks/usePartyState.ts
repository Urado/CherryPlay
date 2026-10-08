import type {
  PartyPlaylistData,
  PlaybackState,
  PartyThemeId,
  CustomizationSettings,
} from '@cherryplay/components';
import {
  DEFAULT_PARTY_THEME_ID,
  isPartyDisplayStatusId,
  isValidPartyTheme,
} from '@cherryplay/components';
import { useState, useCallback, useRef, useEffect } from 'react';

import { partyApiService } from '../services/partyApiService';
import type { PartyDisplayStatusId } from '../types/api';
import { playlistDataFromDto } from '../utils/playlistDataFromDto';

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
  groupDisplayDepth: number;
  customizationSettings: CustomizationSettings<PartyThemeId>;
  playbackState: PlaybackState | null;
  isSessionActive: boolean;
  partyDisplayStatus: PartyDisplayStatusId | null;
  apiReachable: boolean;
  loadPlaylist: (options?: { silent?: boolean }) => Promise<void>;
  setPlaylist: (playlist: PartyPlaylistData | null) => void;
  setPlaybackState: (state: PlaybackState | null) => void;
  setIsSessionActive: (active: boolean) => void;
  setPartyDisplayStatus: (status: PartyDisplayStatusId | null) => void;
  setApiReachable: (reachable: boolean) => void;
  setError: (error: string | null) => void;
  setThemeId: (themeId: PartyThemeId) => void;
  setCustomizationSettings: (settings: CustomizationSettings<PartyThemeId>) => void;
  setPartyName: (name: string | null) => void;
}

export function usePartyState(options: UsePartyStateOptions = {}): UsePartyStateReturn {
  const { shortCode, isDemo = false } = options;

  const [playlist, setPlaylistState] = useState<PartyPlaylistData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [themeId, setThemeId] = useState<PartyThemeId>(DEFAULT_PARTY_THEME_ID);
  const [customizationSettings, setCustomizationSettings] = useState<
    CustomizationSettings<PartyThemeId>
  >({} as CustomizationSettings<PartyThemeId>);
  const [partyName, setPartyName] = useState<string | null>(null);
  const [partyTitle, setPartyTitle] = useState<string | null>(null);
  const [partySubtitle, setPartySubtitle] = useState<string | null>(null);
  const [partyId, setPartyId] = useState<string | null>(null);
  const [playbackState, setPlaybackState] = useState<PlaybackState | null>(null);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [partyDisplayStatus, setPartyDisplayStatus] = useState<PartyDisplayStatusId | null>(null);
  const [apiReachable, setApiReachable] = useState(true);

  const playbackStateRef = useRef<PlaybackState | null>(null);
  const playlistRef = useRef<PartyPlaylistData | null>(null);

  const lastPlaylistFetchAtRef = useRef<Record<string, number>>({});
  const lastPartyInfoFetchAtRef = useRef<Record<string, number>>({});
  const currentPartyKeyRef = useRef<string>('');

  useEffect(() => {
    playbackStateRef.current = playbackState;
  }, [playbackState]);

  useEffect(() => {
    playlistRef.current = playlist;
  }, [playlist]);

  const setPlaylist = useCallback((next: PartyPlaylistData | null) => {
    setPlaylistState(next);
    playlistRef.current = next;
  }, []);

  const loadPlaylist = useCallback(
    async (options?: { silent?: boolean }) => {
      const silent = options?.silent === true;
      const partyKey = isDemo ? 'demo' : (shortCode ?? '');

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
          setApiReachable(true);
        }

        let playlistData: PartyPlaylistData;

        if (isDemo || !shortCode) {
          const dto = await partyApiService.getFirstPartyPlaylist();
          playlistData = playlistDataFromDto(dto);
        } else {
          const dto = await partyApiService.getPartyPlaylist(shortCode);
          playlistData = playlistDataFromDto(dto);

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
              setCustomizationSettings(
                (party.customizationSettings ?? {}) as CustomizationSettings<PartyThemeId>,
              );
              if (isPartyDisplayStatusId(party.partyDisplayStatus)) {
                setPartyDisplayStatus(party.partyDisplayStatus);
              }
            } catch (err) {
              console.warn('[usePartyState] Failed to load party info:', err);
            }
          }
        }

        if (currentPartyKeyRef.current !== partyKey) return;
        setPlaylist(playlistData);
      } catch (err) {
        if (currentPartyKeyRef.current !== partyKey) return;
        const errorMessage = err instanceof Error ? err.message : 'Неизвестная ошибка при загрузке';
        setError(errorMessage);
        setApiReachable(false);
        console.error('[usePartyState] Failed to load playlist:', err);
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [shortCode, isDemo, setPlaylist],
  );

  useEffect(() => {
    loadPlaylist();
  }, [loadPlaylist]);

  const groupDisplayDepth = (() => {
    const value = (customizationSettings as Record<string, unknown>).groupDisplayDepth;
    return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 10
      ? value
      : 3;
  })();

  return {
    playlist,
    loading,
    error,
    partyName,
    partyTitle,
    partySubtitle,
    partyId,
    themeId,
    groupDisplayDepth,
    customizationSettings,
    playbackState,
    isSessionActive,
    partyDisplayStatus,
    apiReachable,
    loadPlaylist,
    setPlaylist,
    setPlaybackState,
    setIsSessionActive,
    setPartyDisplayStatus,
    setApiReachable,
    setError,
    setThemeId,
    setCustomizationSettings,
    setPartyName,
  };
}
