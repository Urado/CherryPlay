import {
  PlaybackState,
  partyThemes,
  type PartyThemeId,
  type CustomizationSettings,
  getDefaultCustomizationSettings,
  isValidPartyTheme,
  normalizeBasicThemePaletteSettings,
  convertUtcToLocalDateTime,
  convertLocalDateTimeToUtc,
  getDefaultTimeZone,
} from '@cherryplay/components';
import { AuthForm } from '@cherryplay/components';
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';

import { WorkspaceId } from '@core/types/workspace';
import { Spinner } from '@shared/components';
import { normalizeTrackKeyForComparison } from '@shared/contracts/aimp';
import { authService } from '@shared/services/authService';
import {
  partyService,
  CreatePartyDto,
  ThemeAccessDto,
  LockedThemeDto,
  ThemeNotEntitledError,
} from '@shared/services/partyService';
import {
  useAuthStore,
  useAimpStore,
  useProjectStore,
  usePlayerAudioStore,
  useSettingsStore,
  useUIStore,
} from '@shared/stores';
import {
  convertToComponentPlayerItems,
  calculatePartyTotalDuration,
  countTotalTracks,
  canUseAimpLiveSnapshots,
  convertAimpPlaylistForApi,
  convertPlaylistForApi,
  createAimpPlaybackStateDto,
  applyPartyTrackDisplayToComponentPlaylist,
  sanitizeExternalUrl,
} from '@shared/utils';
import { setAuthSessionToken } from '@shared/utils/authSession';

import { PartyEditor } from './components/PartyEditor';
import { PartyTrackDisplaySection } from './components/PartyTrackDisplaySection';
import { PartyPreview } from './PartyPreview';
import './PartyView.css';

const RECONNECT_INTERVAL_MS = 60_000;
const ERROR_PARTY_NOT_FOUND = 'Вечеринка не найдена на сервере';
const ERROR_CONNECTION = 'Ошибка соединения с сервером';
const THEME_ACCESS_FALLBACK_ERROR =
  'Не удалось проверить доступ к темам. Для безопасности доступны только базовая и текущая темы.';

function isThemeNotEntitledError(error: unknown): error is ThemeNotEntitledError {
  return error instanceof ThemeNotEntitledError;
}

function resolveLockedThemeByPackageCode(
  access: ThemeAccessDto | null,
  packageCode: string,
): LockedThemeDto | null {
  if (!access) {
    return null;
  }
  return access.visibleLockedThemes.find((item) => item.packageCode === packageCode) ?? null;
}

function buildThemeNotEntitledMessage(
  error: ThemeNotEntitledError,
  access: ThemeAccessDto | null,
): string {
  const firstRequiredPackage = error.requiredPackageCodes[0];
  const lockedThemeInfo = firstRequiredPackage
    ? resolveLockedThemeByPackageCode(access, firstRequiredPackage)
    : null;
  const resolvedPackageLabel = lockedThemeInfo?.packageName ?? firstRequiredPackage ?? null;
  if (resolvedPackageLabel) {
    return `Тема доступна в пакете "${resolvedPackageLabel}".`;
  }

  return 'У вас нет доступа к выбранной теме.';
}

interface PartyViewProps {
  workspaceId: WorkspaceId;
  zoneId: string;
}

interface ThemeEntitlementModalState {
  message: string;
  safeContactUrl: string | null;
}

const REVOKED_THEME_PACKAGE_CODE = 'revoked-current-theme';
const REVOKED_THEME_PACKAGE_NAME = 'Не доступна в пакетах';

function resolveLoadedCustomizationSettings(
  resolvedThemeId: PartyThemeId,
  customizationSettings: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const defaults = getDefaultCustomizationSettings(resolvedThemeId);
  const hasMeaningful =
    customizationSettings &&
    typeof customizationSettings === 'object' &&
    !Array.isArray(customizationSettings) &&
    Object.keys(customizationSettings).length > 0;

  if (!hasMeaningful) {
    return defaults as Record<string, unknown>;
  }

  const raw = customizationSettings as Record<string, unknown>;
  if (resolvedThemeId === 'basic') {
    return normalizeBasicThemePaletteSettings({
      ...defaults,
      ...raw,
    }) as Record<string, unknown>;
  }

  return { ...defaults, ...raw } as Record<string, unknown>;
}

export const PartyView: React.FC<PartyViewProps> = ({
  workspaceId: _workspaceId,
  zoneId: _zoneId,
}) => {
  const items = useProjectStore((state) => state.items);
  const meta = useProjectStore((state) => state.meta);
  const streamingSource = useSettingsStore((state) => state.streamingSource);
  const aimpBridgeState = useAimpStore((state) => state.bridgeState);
  const projectName = useProjectStore((state) => state.name);
  const setLinkedParty = useProjectStore((state) => state.setLinkedParty);
  const markAsDirty = useProjectStore((state) => state.markAsDirty);
  const partyTrackDisplay = useProjectStore((state) => state.meta.partyTrackDisplay);
  const setPartyTrackDisplaySettings = useProjectStore(
    (state) => state.setPartyTrackDisplaySettings,
  );
  const setPartyThemeIdInMeta = useProjectStore((state) => state.setPartyThemeId);
  const setPartyCustomizationSettingsInMeta = useProjectStore(
    (state) => state.setPartyCustomizationSettings,
  );

  const sessionState = useProjectStore((state) => state.sessionState);
  const { mode, currentTrackId, playedTrackIds, disabledTrackIds, disabledGroupIds } = useMemo(
    () => ({
      mode: sessionState.mode,
      currentTrackId: sessionState.currentTrackId,
      playedTrackIds: sessionState.playedTrackIds,
      disabledTrackIds: sessionState.disabledTrackIds,
      disabledGroupIds: sessionState.disabledGroupIds,
    }),
    [sessionState],
  );

  const {
    status: audioStatus,
    position: audioPosition,
    duration: audioDuration,
    volume: audioVolume,
  } = usePlayerAudioStore((state) => ({
    status: state.status,
    position: state.position,
    duration: state.duration,
    volume: state.volume,
  }));

  const [partyName, setPartyName] = useState('');
  const [partyTitle, setPartyTitle] = useState('');
  const [partySubtitle, setPartySubtitle] = useState('');
  const [themeId, setThemeId] = useState<PartyThemeId>('cyberpunk');
  const [customizationSettings, setCustomizationSettings] = useState<Record<string, unknown>>(
    getDefaultCustomizationSettings('cyberpunk'),
  );
  const [eventDateTime, setEventDateTime] = useState<string>('');
  const [eventEndDateTime, setEventEndDateTime] = useState<string>('');
  const [hasInitialEventEndDateTime, setHasInitialEventEndDateTime] = useState<boolean>(false);
  const [eventEndDateTimeTouched, setEventEndDateTimeTouched] = useState<boolean>(false);
  const [description, setDescription] = useState<string>('');
  const [place, setPlace] = useState<string>('');
  const [city, setCity] = useState<string>('');
  const [schedule, setSchedule] = useState<string>('');
  const [timeZone, setTimeZone] = useState<string>('');
  const [shortDescription, setShortDescription] = useState<string>('');
  const [externalLinkUrl, setExternalLinkUrl] = useState<string>('');
  const [externalLinkText, setExternalLinkText] = useState<string>('');
  const [danceTags, setDanceTags] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isCheckingParty, setIsCheckingParty] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [partyVerified, setPartyVerified] = useState(false);
  const [serverUnreachable, setServerUnreachable] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [lastManualCheckFailed, setLastManualCheckFailed] = useState(false);
  const [themeAccess, setThemeAccess] = useState<ThemeAccessDto | null>(null);
  const [isThemeAccessLoading, setIsThemeAccessLoading] = useState(false);
  const [themeAccessErrorMessage, setThemeAccessErrorMessage] = useState<string | null>(null);
  const [themeEntitlementModal, setThemeEntitlementModal] =
    useState<ThemeEntitlementModalState | null>(null);
  const reconnectIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectCancelledRef = useRef(false);

  const { openModal, addNotification } = useUIStore((state) => ({
    openModal: state.openModal,
    addNotification: state.addNotification,
  }));
  const authStore = useAuthStore();
  const isAuthenticated = authStore.isAuthenticated;
  const isAuth = isAuthenticated();

  useEffect(() => {
    if (typeof window === 'undefined' || !window.api || isAuth) {
      return;
    }

    let isMounted = true;

    const registerCallback = async () => {
      try {
        const result = (await window.api.invoke('auth:registerCallback')) as
          | { success: true; data: { code: string; provider: string } }
          | { success: false; error: string };

        if (isMounted && result.success && result.data) {
          const { code, provider } = result.data;
          try {
            const deviceId = `desktop-${Date.now()}`;
            const token = await authService.exchangeCode(code, provider, deviceId);
            setAuthSessionToken(token);

            const organizerInfo = await authService.getCurrentOrganizer();
            authStore.setOrganizer({ id: organizerInfo.id, name: organizerInfo.name });

            addNotification({
              type: 'success',
              message: 'Успешный вход в систему',
              duration: 3000,
            });
          } catch (error) {
            addNotification({
              type: 'error',
              message: error instanceof Error ? error.message : 'Ошибка при входе',
              duration: 5000,
            });
          }
        }
      } catch (error) {
        if (isMounted && error instanceof Error && !error.message.includes('timeout')) {
          console.error('Error handling OAuth callback:', error);
        }
      }
    };

    registerCallback();

    return () => {
      isMounted = false;
    };
  }, [isAuth, authStore, addNotification]);

  const handleThemeChange = (newThemeId: PartyThemeId) => {
    setThemeId(newThemeId);
    const next = getDefaultCustomizationSettings(newThemeId) as Record<string, unknown>;
    setCustomizationSettings(next);
    setPartyThemeIdInMeta(newThemeId);
    setPartyCustomizationSettingsInMeta(next);
  };

  const loadThemeAccess = useCallback(
    async (forceRefresh = false) => {
      if (!isAuth) {
        setThemeAccess(null);
        setThemeAccessErrorMessage(null);
        return;
      }

      setIsThemeAccessLoading(true);
      try {
        const access = await partyService.getThemeAccess(forceRefresh);
        setThemeAccess(access);
        setThemeAccessErrorMessage(null);
      } catch (error) {
        console.warn('Failed to load theme access:', error);
        setThemeAccess(null);
        setThemeAccessErrorMessage(THEME_ACCESS_FALLBACK_ERROR);
      } finally {
        setIsThemeAccessLoading(false);
      }
    },
    [isAuth],
  );

  const handleCustomizationSettingsChange = useCallback(
    (settings: Record<string, unknown>) => {
      setCustomizationSettings(settings);
      setPartyCustomizationSettingsInMeta(settings);
    },
    [setPartyCustomizationSettingsInMeta],
  );

  useEffect(() => {
    const tid = meta.partyThemeId;
    if (tid && isValidPartyTheme(tid)) {
      setThemeId(tid as PartyThemeId);
      setCustomizationSettings(
        resolveLoadedCustomizationSettings(tid as PartyThemeId, meta.partyCustomizationSettings),
      );
    } else {
      setThemeId('cyberpunk');
      setCustomizationSettings(
        getDefaultCustomizationSettings('cyberpunk') as Record<string, unknown>,
      );
    }
  }, [meta.partyThemeId, meta.partyCustomizationSettings]);

  const componentItems = useMemo(() => {
    const converted = convertToComponentPlayerItems(items);
    const removePath = (items: typeof converted): typeof converted => {
      return items.map((item) => {
        if (item.type === 'track') {
          const { path: _path, ...trackWithoutPath } = item;
          return trackWithoutPath;
        } else if (item.type === 'group' && item.items) {
          return {
            ...item,
            items: removePath(item.items),
          };
        }
        return item;
      });
    };
    return removePath(converted);
  }, [items]);

  const playlistData = useMemo(() => {
    if (
      streamingSource === 'aimp' &&
      aimpBridgeState.playlistSnapshot &&
      aimpBridgeState.playlistSnapshot.tracks.length > 0
    ) {
      const aimpPlaylist = convertAimpPlaylistForApi(aimpBridgeState.playlistSnapshot);
      return {
        items: aimpPlaylist.items,
        totalDuration: aimpPlaylist.totalDuration,
        totalTracks: aimpPlaylist.totalTracks,
      };
    }
    return {
      items: componentItems,
      totalDuration: calculatePartyTotalDuration(items),
      totalTracks: countTotalTracks(items),
    };
  }, [streamingSource, aimpBridgeState.playlistSnapshot, componentItems, items]);

  const previewPlaylistData = useMemo(
    () => ({
      ...playlistData,
      items: applyPartyTrackDisplayToComponentPlaylist(playlistData.items, partyTrackDisplay),
    }),
    [playlistData, partyTrackDisplay],
  );

  const playbackState: PlaybackState | null = useMemo(() => {
    if (
      streamingSource === 'aimp' &&
      aimpBridgeState.liveStreamStarted &&
      canUseAimpLiveSnapshots(aimpBridgeState)
    ) {
      const dto = createAimpPlaybackStateDto(aimpBridgeState) as PlaybackState;
      const resolvedCurrentTrackId =
        dto.currentTrackId && aimpBridgeState.playlistSnapshot
          ? (() => {
              const normalized = normalizeTrackKeyForComparison(dto.currentTrackId!);
              const match = aimpBridgeState.playlistSnapshot!.tracks.find(
                (t) => normalizeTrackKeyForComparison(t.trackKey) === normalized,
              );
              return match ? match.trackKey : dto.currentTrackId;
            })()
          : dto.currentTrackId;
      return { ...dto, currentTrackId: resolvedCurrentTrackId };
    }
    if (mode !== 'session') {
      return null;
    }

    return {
      currentTrackId,
      status: audioStatus,
      position: audioPosition,
      duration: audioDuration,
      volume: audioVolume,
      mode: 'session',
      playedTrackIds,
      disabledTrackIds,
      disabledGroupIds,
      lastUpdatedAt: new Date().toISOString(),
    };
  }, [
    streamingSource,
    aimpBridgeState.liveStreamStarted,
    aimpBridgeState.playlistSnapshot,
    aimpBridgeState.playbackSnapshot,
    aimpBridgeState.connection.phase,
    mode,
    currentTrackId,
    audioStatus,
    audioPosition,
    audioDuration,
    audioVolume,
    playedTrackIds,
    disabledTrackIds,
    disabledGroupIds,
  ]);

  const stopReconnectTimer = useCallback(() => {
    if (reconnectIntervalRef.current !== null) {
      clearInterval(reconnectIntervalRef.current);
      reconnectIntervalRef.current = null;
    }
  }, []);

  const loadPartyMetadata = useCallback(
    async (partyId: string) => {
      try {
        const party = await partyService.getParty(partyId);
        if (party.name) setPartyName(party.name);
        setPartyTitle(party.title ?? '');
        setPartySubtitle(party.subtitle ?? '');
        const resolvedThemeId: PartyThemeId =
          party.partyThemeId && isValidPartyTheme(party.partyThemeId)
            ? party.partyThemeId
            : 'cyberpunk';
        setThemeId(resolvedThemeId);
        const resolvedCustomization = resolveLoadedCustomizationSettings(
          resolvedThemeId,
          party.customizationSettings,
        );
        setCustomizationSettings(resolvedCustomization);
        setPartyThemeIdInMeta(resolvedThemeId, { skipMarkDirty: true });
        setPartyCustomizationSettingsInMeta(resolvedCustomization, { skipMarkDirty: true });
        const tz = party.timeZone || getDefaultTimeZone();
        setTimeZone(tz);
        if (party.eventDateTime) {
          const local = convertUtcToLocalDateTime(party.eventDateTime, tz);
          if (local) setEventDateTime(local);
        } else {
          setEventDateTime('');
        }
        if (party.eventEndDateTime) {
          const localEnd = convertUtcToLocalDateTime(party.eventEndDateTime, tz);
          if (localEnd) {
            setEventEndDateTime(localEnd);
            setHasInitialEventEndDateTime(true);
          } else {
            setEventEndDateTime('');
            setHasInitialEventEndDateTime(false);
          }
        } else {
          setEventEndDateTime('');
          setHasInitialEventEndDateTime(false);
        }
        if (party.description) setDescription(party.description);
        if (party.place) setPlace(party.place);
        if (party.city) setCity(party.city);
        if (party.schedule) setSchedule(party.schedule);
        setShortDescription(party.shortDescription ?? '');
        setExternalLinkUrl(party.externalLinkUrl ?? '');
        setExternalLinkText(party.externalLinkText ?? '');
        setDanceTags(party.danceTags ? [...new Set(party.danceTags)] : []);
        setEventEndDateTimeTouched(false);
      } catch (error) {
        console.error('Failed to load party metadata:', error);
      }
    },
    [setPartyCustomizationSettingsInMeta, setPartyThemeIdInMeta],
  );

  const handleEventEndDateTimeChange = useCallback((value: string) => {
    setEventEndDateTime(value);
    setEventEndDateTimeTouched(true);
  }, []);

  const restoreAfterReconnect = useCallback(
    async (linkedParty: { id: string; shortCode: string }) => {
      try {
        const exists = await partyService.checkPartyExists(linkedParty.id);
        setPartyVerified(exists);
        if (!exists) {
          setServerError(ERROR_PARTY_NOT_FOUND);
          return;
        }
        setServerError(null);

        const url = await partyService.getPartyUrl(linkedParty.shortCode);
        setLinkedParty({ ...linkedParty, url });

        if (isAuth) {
          await loadPartyMetadata(linkedParty.id);
        }
      } catch (error) {
        console.error('Failed to restore after reconnect:', error);
        setServerError(ERROR_CONNECTION);
        setPartyVerified(false);
      }
    },
    [isAuth, loadPartyMetadata, setLinkedParty],
  );

  const startReconnectTimer = useCallback(
    (linkedParty: { id: string; shortCode: string } | null) => {
      stopReconnectTimer();
      reconnectCancelledRef.current = false;
      reconnectIntervalRef.current = setInterval(() => {
        void (async () => {
          if (reconnectCancelledRef.current) return;
          setIsReconnecting(true);
          try {
            const reachable = await partyService.checkServerReachable();
            if (reconnectCancelledRef.current) return;
            if (reachable) {
              stopReconnectTimer();
              if (!reconnectCancelledRef.current) setServerUnreachable(false);
              if (!reconnectCancelledRef.current) setLastManualCheckFailed(false);
              if (linkedParty) {
                await restoreAfterReconnect(linkedParty);
              } else {
                if (!reconnectCancelledRef.current) setServerError(null);
                if (!reconnectCancelledRef.current) setPartyVerified(false);
              }
            }
          } catch {
            void 0;
          } finally {
            if (!reconnectCancelledRef.current) setIsReconnecting(false);
          }
        })();
      }, RECONNECT_INTERVAL_MS);
    },
    [stopReconnectTimer, restoreAfterReconnect],
  );

  const checkPartyExists = useCallback(async (partyId: string): Promise<boolean> => {
    try {
      setIsCheckingParty(true);
      setServerError(null);
      const exists = await partyService.checkPartyExists(partyId);
      setPartyVerified(exists);
      if (!exists) {
        setServerError(ERROR_PARTY_NOT_FOUND);
      }
      return exists;
    } catch (error) {
      console.error('Failed to check party existence:', error);
      setServerError(ERROR_CONNECTION);
      setPartyVerified(false);
      return false;
    } finally {
      setIsCheckingParty(false);
    }
  }, []);

  const handleManualReconnect = useCallback(async () => {
    const linkedParty = meta.linkedParty;
    setIsReconnecting(true);
    try {
      const reachable = await partyService.checkServerReachable();
      if (reachable) {
        stopReconnectTimer();
        setServerUnreachable(false);
        setLastManualCheckFailed(false);
        if (linkedParty) {
          await restoreAfterReconnect(linkedParty);
        } else {
          setServerError(null);
          setPartyVerified(false);
        }
      } else {
        setLastManualCheckFailed(true);
      }
    } catch {
      setLastManualCheckFailed(true);
    } finally {
      setIsReconnecting(false);
    }
  }, [meta.linkedParty, stopReconnectTimer, restoreAfterReconnect]);

  const handleRetry = useCallback(async () => {
    if (meta.linkedParty) {
      await checkPartyExists(meta.linkedParty.id);
    } else {
      setServerError(null);
      setPartyVerified(false);
    }
  }, [meta.linkedParty, checkPartyExists]);

  useEffect(() => {
    if (meta.linkedParty) {
      let cancelled = false;
      const linkedParty = meta.linkedParty;

      void (async () => {
        setIsCheckingParty(true);
        setServerError(null);
        try {
          const reachable = await partyService.checkServerReachable();
          if (cancelled) return;
          if (!reachable) {
            setServerUnreachable(true);
            setPartyVerified(false);
            startReconnectTimer(linkedParty);
            return;
          }
          setServerUnreachable(false);
          stopReconnectTimer();
          const exists = await partyService.checkPartyExists(linkedParty.id);
          if (cancelled) return;
          setPartyVerified(exists);
          if (!exists) {
            setServerError(ERROR_PARTY_NOT_FOUND);
          }
        } catch {
          if (!cancelled) {
            setServerUnreachable(true);
            setPartyVerified(false);
            startReconnectTimer(linkedParty);
          }
        } finally {
          if (!cancelled) setIsCheckingParty(false);
        }
      })();

      return () => {
        cancelled = true;
        stopReconnectTimer();
        reconnectCancelledRef.current = true;
      };
    } else {
      setPartyVerified(false);
      setServerError(null);
      setServerUnreachable(false);
      stopReconnectTimer();
    }
  }, [meta.linkedParty, startReconnectTimer, stopReconnectTimer]);

  useEffect(() => {
    if (meta.linkedParty && isAuth) {
      void loadPartyMetadata(meta.linkedParty.id);
    }
  }, [meta.linkedParty, isAuth, loadPartyMetadata]);

  useEffect(() => {
    void loadThemeAccess();
  }, [loadThemeAccess]);

  const visibleThemeIds: PartyThemeId[] | null = useMemo(() => {
    if (!themeAccess) {
      return null;
    }

    const visible = new Set<PartyThemeId>();
    for (const id of themeAccess.grantedThemeIds) {
      if (isValidPartyTheme(id)) {
        visible.add(id);
      }
    }
    for (const item of themeAccess.visibleLockedThemes) {
      if (isValidPartyTheme(item.themeId)) {
        visible.add(item.themeId);
      }
    }
    if (isValidPartyTheme(themeId)) {
      visible.add(themeId);
    }

    return partyThemes.map((theme) => theme.id).filter((id) => visible.has(id));
  }, [themeAccess, themeId]);

  const lockedThemeInfos = useMemo(() => {
    if (!themeAccess) {
      return [];
    }

    const locked = new Map<
      PartyThemeId,
      { themeId: PartyThemeId; packageCode: string; packageName: string }
    >();
    for (const item of themeAccess.visibleLockedThemes) {
      if (!isValidPartyTheme(item.themeId)) {
        continue;
      }
      locked.set(item.themeId, {
        themeId: item.themeId,
        packageCode: item.packageCode,
        packageName: item.packageName,
      });
    }

    const isCurrentThemeGranted = themeAccess.grantedThemeIds.some((id) => id === themeId);
    if (!isCurrentThemeGranted && isValidPartyTheme(themeId) && !locked.has(themeId)) {
      locked.set(themeId, {
        themeId,
        packageCode: REVOKED_THEME_PACKAGE_CODE,
        packageName: REVOKED_THEME_PACKAGE_NAME,
      });
    }

    return Array.from(locked.values());
  }, [themeAccess, themeId]);

  const normalizeCustomizationSettings = (
    settings: Record<string, unknown> | undefined,
  ): Record<string, unknown> | undefined => {
    if (!settings) {
      return undefined;
    }

    const normalized = Object.entries(settings).reduce(
      (acc, [key, value]) => {
        if (value === null || value === undefined) {
          return acc;
        }

        const valueType = typeof value;
        if (valueType === 'string') {
          acc[key] = value as string;
        } else if (valueType === 'number' && !isNaN(value as number) && isFinite(value as number)) {
          acc[key] = value as number;
        } else if (key === 'basicUserSavedPalettes' && Array.isArray(value)) {
          acc[key] = value;
        } else if (valueType === 'object' && !Array.isArray(value)) {
          acc[key] = value as Record<string, unknown>;
        }
        return acc;
      },
      {} as Record<string, unknown>,
    );

    return Object.keys(normalized).length > 0 ? normalized : undefined;
  };

  const handleThemeNotEntitled = useCallback(
    async (error: ThemeNotEntitledError) => {
      const message = buildThemeNotEntitledMessage(error, themeAccess);
      const safeContactUrl = sanitizeExternalUrl(themeAccess?.contactUrl);

      addNotification({
        type: 'error',
        message,
        duration: 7000,
      });

      setThemeEntitlementModal({
        message,
        safeContactUrl,
      });

      await loadThemeAccess(true);
    },
    [themeAccess, addNotification, loadThemeAccess],
  );

  const handleCreateParty = async () => {
    if (!isAuth) {
      addNotification({
        type: 'warning',
        message: 'Для создания вечеринки необходимо войти в аккаунт',
        duration: 5000,
      });
      openModal('account');
      return;
    }
    if (!partyName.trim()) {
      addNotification({
        type: 'warning',
        message: 'Введите название вечеринки',
      });
      return;
    }

    setIsCreating(true);
    setServerError(null);
    setPartyVerified(false);
    try {
      const playlistForApi =
        streamingSource === 'aimp' && aimpBridgeState.playlistSnapshot
          ? convertAimpPlaylistForApi(aimpBridgeState.playlistSnapshot, partyTrackDisplay)
          : convertPlaylistForApi(items, partyTrackDisplay);

      const tz = timeZone.trim() || getDefaultTimeZone();
      const createData: CreatePartyDto = {
        name: partyName,
        title: partyTitle.trim() || undefined,
        subtitle: partySubtitle.trim() || undefined,
        partyThemeId: themeId,
        customizationSettings: normalizeCustomizationSettings(customizationSettings),
        playlistData: playlistForApi,
        eventDateTime: eventDateTime ? convertLocalDateTimeToUtc(eventDateTime, tz) : undefined,
        eventEndDateTime: eventEndDateTime
          ? convertLocalDateTimeToUtc(eventEndDateTime, tz)
          : undefined,
        description: description.trim() || undefined,
        place: place.trim() || undefined,
        city: city.trim() || undefined,
        schedule: schedule.trim() || undefined,
        timeZone: timeZone.trim() || undefined,
        isListedInCatalog: true,
        shortDescription: shortDescription.trim() || undefined,
        externalLinkUrl: externalLinkUrl.trim() || undefined,
        externalLinkText: externalLinkText.trim() || undefined,
        danceTags: danceTags.length > 0 ? danceTags : undefined,
      };

      const party = await partyService.createParty(createData);
      await loadThemeAccess(true);

      const exists = await checkPartyExists(party.id);

      if (!exists) {
        addNotification({
          type: 'error',
          message: 'Вечеринка создана, но сервер недоступен',
        });
        return;
      }

      const url = await partyService.getPartyUrl(party.shortCode);
      const partyData = { id: party.id, shortCode: party.shortCode, url };
      setLinkedParty(partyData);
      setPartyVerified(true);
      markAsDirty();

      addNotification({
        type: 'success',
        message: 'Вечеринка успешно создана',
      });
    } catch (error) {
      console.error('Failed to create party:', error);
      if (isThemeNotEntitledError(error)) {
        await handleThemeNotEntitled(error);
        return;
      }
      const reachable = await partyService.checkServerReachable();
      if (!reachable) {
        setServerUnreachable(true);
        startReconnectTimer(null);
      } else {
        setServerError(ERROR_CONNECTION);
      }
      setPartyVerified(false);
      addNotification({
        type: 'error',
        message: 'Ошибка при создании вечеринки',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handlePublish = async () => {
    if (!isAuth) {
      addNotification({
        type: 'warning',
        message: 'Для публикации необходимо войти в аккаунт',
        duration: 5000,
      });
      openModal('account');
      return;
    }

    const linkedParty = meta.linkedParty;
    if (linkedParty) {
      setIsPublishing(true);
      setServerError(null);
      try {
        const playlistForApi =
          streamingSource === 'aimp' && aimpBridgeState.playlistSnapshot
            ? convertAimpPlaylistForApi(aimpBridgeState.playlistSnapshot, partyTrackDisplay)
            : convertPlaylistForApi(items, partyTrackDisplay);
        await partyService.updatePartyPlaylist(linkedParty.id, playlistForApi);

        const tz = timeZone.trim() || getDefaultTimeZone();
        let eventEndDateTimeForUpdate: string | null | undefined = undefined;

        if (eventEndDateTimeTouched) {
          if (!eventEndDateTime.trim()) {
            eventEndDateTimeForUpdate = hasInitialEventEndDateTime ? null : undefined;
          } else {
            eventEndDateTimeForUpdate = convertLocalDateTimeToUtc(eventEndDateTime, tz);
          }
        }

        await partyService.updateParty(linkedParty.id, {
          name: partyName,
          title: partyTitle.trim() || undefined,
          subtitle: partySubtitle.trim() || undefined,
          partyThemeId: themeId,
          customizationSettings: normalizeCustomizationSettings(customizationSettings),
          eventDateTime: eventDateTime ? convertLocalDateTimeToUtc(eventDateTime, tz) : undefined,
          eventEndDateTime: eventEndDateTimeForUpdate,
          description: description.trim() || undefined,
          place: place.trim() || undefined,
          city: city.trim() || undefined,
          schedule: schedule.trim() || undefined,
          timeZone: timeZone.trim() || undefined,
          shortDescription: shortDescription.trim(),
          externalLinkUrl: externalLinkUrl.trim(),
          externalLinkText: externalLinkText.trim(),
          danceTags,
        });
        await loadThemeAccess(true);

        addNotification({ type: 'success', message: 'Плейлист и метаданные опубликованы' });
      } catch (error) {
        console.error('Failed to publish playlist:', error);
        if (isThemeNotEntitledError(error)) {
          await handleThemeNotEntitled(error);
          return;
        }
        addNotification({
          type: 'error',
          message: error instanceof Error ? error.message : 'Ошибка публикации',
        });
      } finally {
        setIsPublishing(false);
      }
      return;
    }

    const nameToUse = partyName.trim() || projectName.trim() || 'Вечеринка';
    if (!partyName.trim()) {
      setPartyName(nameToUse);
    }

    setIsCreating(true);
    setServerError(null);
    setPartyVerified(false);
    try {
      const playlistForApi =
        streamingSource === 'aimp' && aimpBridgeState.playlistSnapshot
          ? convertAimpPlaylistForApi(aimpBridgeState.playlistSnapshot, partyTrackDisplay)
          : convertPlaylistForApi(items, partyTrackDisplay);
      const tz = timeZone.trim() || getDefaultTimeZone();
      const createData: CreatePartyDto = {
        name: nameToUse,
        title: partyTitle.trim() || undefined,
        subtitle: partySubtitle.trim() || undefined,
        partyThemeId: themeId,
        customizationSettings: normalizeCustomizationSettings(customizationSettings),
        playlistData: playlistForApi,
        eventDateTime: eventDateTime ? convertLocalDateTimeToUtc(eventDateTime, tz) : undefined,
        eventEndDateTime: eventEndDateTime
          ? convertLocalDateTimeToUtc(eventEndDateTime, tz)
          : undefined,
        description: description.trim() || undefined,
        place: place.trim() || undefined,
        city: city.trim() || undefined,
        schedule: schedule.trim() || undefined,
        timeZone: timeZone.trim() || undefined,
        isListedInCatalog: true,
        shortDescription: shortDescription.trim() || undefined,
        externalLinkUrl: externalLinkUrl.trim() || undefined,
        externalLinkText: externalLinkText.trim() || undefined,
        danceTags: danceTags.length > 0 ? danceTags : undefined,
      };

      const party = await partyService.createParty(createData);
      await loadThemeAccess(true);
      const exists = await checkPartyExists(party.id);
      if (!exists) {
        addNotification({ type: 'error', message: 'Вечеринка создана, но сервер недоступен' });
        return;
      }

      const url = await partyService.getPartyUrl(party.shortCode);
      const partyData = { id: party.id, shortCode: party.shortCode, url };
      setLinkedParty(partyData);
      setPartyVerified(true);
      markAsDirty();
      addNotification({ type: 'success', message: 'Вечеринка создана и опубликована' });
    } catch (error) {
      console.error('Failed to publish:', error);
      if (isThemeNotEntitledError(error)) {
        await handleThemeNotEntitled(error);
        return;
      }
      const reachable = await partyService.checkServerReachable();
      if (!reachable) {
        setServerUnreachable(true);
        startReconnectTimer(null);
      } else {
        setServerError(ERROR_CONNECTION);
      }
      addNotification({
        type: 'error',
        message: error instanceof Error ? error.message : 'Ошибка публикации',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopyUrl = async () => {
    const url = meta.linkedParty?.url;
    if (!url) {
      addNotification({
        type: 'error',
        message: 'URL вечеринки ещё не загружен',
      });
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      addNotification({
        type: 'success',
        message: 'URL скопирован в буфер обмена',
      });
    } catch (error) {
      console.error('Failed to copy URL:', error);
      addNotification({
        type: 'error',
        message: 'Не удалось скопировать URL',
      });
    }
  };

  if (!isAuth) {
    return (
      <div className="party-view">
        <AuthForm
          title="Требуется авторизация"
          description="Для работы с вечеринками необходимо войти в аккаунт"
          compact={false}
          authService={authService}
        />
      </div>
    );
  }

  if (isCheckingParty) {
    return (
      <div className="party-view">
        <div className="party-view-loading" role="status" aria-label="Загрузка...">
          <Spinner size="large" />
        </div>
      </div>
    );
  }

  if (serverUnreachable) {
    return (
      <div className="party-view">
        <div className="party-view-no-connection">
          <div className="party-view-no-connection-icon">🔌</div>
          <p className="party-view-no-connection-title">Не удалось подключиться к серверу</p>
          {isReconnecting && (
            <p className="party-view-no-connection-hint">Проверка соединения...</p>
          )}
          <button
            className="action-button party-view-no-connection-retry"
            onClick={() => void handleManualReconnect()}
            disabled={isReconnecting}
            type="button"
          >
            {isReconnecting ? 'Проверка...' : 'Проверить сейчас'}
          </button>
          {lastManualCheckFailed && !isReconnecting && (
            <p className="party-view-no-connection-hint">Сервер недоступен</p>
          )}
        </div>
      </div>
    );
  }

  const linkedParty = meta.linkedParty;

  return (
    <div className="party-view">
      {linkedParty && (
        <div className="party-view-linked-banner">
          <span className="party-view-linked-banner-icon">🔗</span>
          <span className="party-view-linked-banner-text">
            Привязано к вечеринке: <strong>/{linkedParty.shortCode}</strong>
          </span>
          {linkedParty.url && (
            <a
              href={linkedParty.url}
              target="_blank"
              rel="noopener noreferrer"
              className="party-view-linked-banner-link"
            >
              Открыть в браузере
            </a>
          )}
        </div>
      )}
      <div className="party-view-header">
        <h2>Создание вечеринки</h2>
      </div>

      <div className="party-view-content">
        <div className="party-view-editor">
          <PartyTrackDisplaySection
            value={partyTrackDisplay}
            onChange={setPartyTrackDisplaySettings}
          />
          <PartyEditor
            partyName={partyName}
            partyTitle={partyTitle}
            partySubtitle={partySubtitle}
            themeId={themeId}
            customizationSettings={customizationSettings}
            eventDateTime={eventDateTime}
            eventEndDateTime={eventEndDateTime}
            description={description}
            place={place}
            city={city}
            schedule={schedule}
            timeZone={timeZone}
            shortDescription={shortDescription}
            externalLinkUrl={externalLinkUrl}
            externalLinkText={externalLinkText}
            danceTags={danceTags}
            onPartyNameChange={setPartyName}
            onPartyTitleChange={setPartyTitle}
            onPartySubtitleChange={setPartySubtitle}
            onThemeIdChange={handleThemeChange}
            onCustomizationSettingsChange={handleCustomizationSettingsChange}
            onEventDateTimeChange={setEventDateTime}
            onEventEndDateTimeChange={handleEventEndDateTimeChange}
            onDescriptionChange={setDescription}
            onPlaceChange={setPlace}
            onCityChange={setCity}
            onScheduleChange={setSchedule}
            onShortDescriptionChange={setShortDescription}
            onExternalLinkUrlChange={setExternalLinkUrl}
            onExternalLinkTextChange={setExternalLinkText}
            onDanceTagsChange={setDanceTags}
            onTimeZoneChange={(newTz) => {
              const oldTz = timeZone.trim() || getDefaultTimeZone();
              setTimeZone(newTz);
              setEventDateTime(
                convertUtcToLocalDateTime(convertLocalDateTimeToUtc(eventDateTime, oldTz), newTz),
              );
              if (eventEndDateTime) {
                const updatedEnd = convertUtcToLocalDateTime(
                  convertLocalDateTimeToUtc(eventEndDateTime, oldTz),
                  newTz,
                );
                setEventEndDateTime(updatedEnd);
                setEventEndDateTimeTouched(true);
              }
            }}
            onCreateParty={handleCreateParty}
            onPublish={handlePublish}
            isCreating={isCreating}
            isPublishing={isPublishing}
            isAuthenticated={isAuth}
            linkedParty={meta.linkedParty}
            serverError={serverError}
            isCheckingParty={isCheckingParty}
            onCopyUrl={handleCopyUrl}
            onRetry={handleRetry}
            onOpenLinkParty={() => openModal('linkParty')}
            lockedThemes={lockedThemeInfos}
            accessContactUrl={themeAccess?.contactUrl ?? ''}
            isThemeAccessLoading={isThemeAccessLoading}
            visibleThemeIds={visibleThemeIds}
            themeAccessErrorMessage={themeAccessErrorMessage}
          />
        </div>

        <div className="party-view-preview">
          <h3>Превью (как будет выглядеть в браузере)</h3>
          <PartyPreview
            playlist={previewPlaylistData}
            themeId={themeId}
            customizationSettings={customizationSettings as CustomizationSettings<PartyThemeId>}
            playbackState={playbackState}
            partyName={partyTitle.trim() || partyName || 'Превью вечеринки'}
            subtitle={partySubtitle.trim() || undefined}
          />
        </div>
      </div>
      {themeEntitlementModal && (
        <div className="party-editor-locked-theme-modal-overlay" role="dialog" aria-modal="true">
          <div className="party-editor-locked-theme-modal">
            <h4 className="party-editor-locked-theme-title">Тема недоступна</h4>
            <p className="party-editor-locked-theme-text">
              {themeEntitlementModal.message} Можно подключить быстро, если нужно.
            </p>
            {themeEntitlementModal.safeContactUrl ? (
              <a
                href={themeEntitlementModal.safeContactUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="party-editor-locked-theme-cta"
              >
                Напиши в ВК
              </a>
            ) : (
              <p className="party-editor-locked-theme-text">
                Ссылка на ВК сейчас недоступна. Попробуй чуть позже.
              </p>
            )}
            <button
              type="button"
              className="party-editor-button party-editor-button-secondary"
              onClick={() => setThemeEntitlementModal(null)}
            >
              Понятно
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
