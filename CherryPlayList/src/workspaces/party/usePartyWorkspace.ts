import {
  PlaybackState,
  partyThemes,
  type PartyThemeId,
  getDefaultCustomizationSettings,
  isValidPartyTheme,
  convertUtcToLocalDateTime,
  convertLocalDateTimeToUtc,
  getDefaultTimeZone,
} from '@cherryplay/components';
import { useMemo, useEffect, useCallback, useRef } from 'react';

import { normalizeTrackKeyForComparison } from '@shared/contracts/aimp';
import { getPlatform, getPlatformCapabilities, isPlatformInitialized } from '@shared/platform';
import { authService } from '@shared/services/authService';
import {
  partyService,
  InvalidPartyLifecycleTransitionError,
  ThemeNotEntitledError,
  type PartyLifecycleState,
} from '@shared/services/partyService';
import {
  useAuthStore,
  useAimpStore,
  useClientOutdatedStore,
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
  createAimpPlaybackStateDto,
  applyPartyTrackDisplayToComponentPlaylist,
  sanitizeExternalUrl,
} from '@shared/utils';
import { setAuthSessionToken } from '@shared/utils/authSession';

import { buildCreatePartyDto, buildPlaylistForApi } from './partyWorkspaceApiBuilders';
import {
  clearPartyWorkspaceLinkedPartyCheck,
  partyWorkspaceLinkedPartyCheck,
  partyWorkspaceOneShotGuards,
  partyWorkspaceReconnectRefs,
} from './partyWorkspaceReconnectRefs';
import {
  resetPartyLinkState,
  resetPartyWorkspaceState,
  usePartyWorkspaceStore,
} from './partyWorkspaceStore';
import {
  buildThemeNotEntitledMessage,
  ERROR_CONNECTION,
  ERROR_PARTY_NOT_FOUND,
  isThemeNotEntitledError,
  normalizeCustomizationSettings,
  RECONNECT_INTERVAL_MS,
  resolveLoadedCustomizationSettings,
  REVOKED_THEME_PACKAGE_CODE,
  REVOKED_THEME_PACKAGE_NAME,
  THEME_ACCESS_FALLBACK_ERROR,
} from './partyWorkspaceUtils';

const LIFECYCLE_TRANSITION_SUCCESS_MESSAGES: Record<PartyLifecycleState, string> = {
  draft: 'Вечеринка переведена в черновик',
  ready: 'Вечеринка опубликована и готова к мероприятию',
  completed: 'Вечеринка завершена',
};

const getPartyStore = () => usePartyWorkspaceStore.getState();

export function usePartyWorkspaceRuntime() {
  const items = useProjectStore((state) => state.items);
  const meta = useProjectStore((state) => state.meta);
  const projectContextKey = useProjectStore(
    (state) => `${state.meta.filePath ?? ''}\0${state.name}`,
  );
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

  const {
    partyName,
    partyTitle,
    partySubtitle,
    themeId,
    customizationSettings,
    eventDateTime,
    eventEndDateTime,
    description,
    place,
    city,
    schedule,
    timeZone,
    shortDescription,
    externalLinkUrl,
    externalLinkText,
    danceTags,
    isCreating,
    isPublishing,
    partyLifecycleState,
    isTransitioningLifecycle,
    isCheckingParty,
    serverError,
    serverUnreachable,
    isReconnecting,
    lastManualCheckFailed,
    themeAccess,
    isThemeAccessLoading,
    themeAccessErrorMessage,
    themeEntitlementModal,
    setPartyName,
    setPartyTitle,
    setPartySubtitle,
    setEventDateTime,
    setDescription,
    setPlace,
    setCity,
    setSchedule,
    setShortDescription,
    setExternalLinkUrl,
    setExternalLinkText,
    setDanceTags,
    setThemeEntitlementModal,
  } = usePartyWorkspaceStore((state) => ({
    partyName: state.partyName,
    partyTitle: state.partyTitle,
    partySubtitle: state.partySubtitle,
    themeId: state.themeId,
    customizationSettings: state.customizationSettings,
    eventDateTime: state.eventDateTime,
    eventEndDateTime: state.eventEndDateTime,
    description: state.description,
    place: state.place,
    city: state.city,
    schedule: state.schedule,
    timeZone: state.timeZone,
    shortDescription: state.shortDescription,
    externalLinkUrl: state.externalLinkUrl,
    externalLinkText: state.externalLinkText,
    danceTags: state.danceTags,
    isCreating: state.isCreating,
    isPublishing: state.isPublishing,
    partyLifecycleState: state.partyLifecycleState,
    isTransitioningLifecycle: state.isTransitioningLifecycle,
    isCheckingParty: state.isCheckingParty,
    serverError: state.serverError,
    serverUnreachable: state.serverUnreachable,
    isReconnecting: state.isReconnecting,
    lastManualCheckFailed: state.lastManualCheckFailed,
    themeAccess: state.themeAccess,
    isThemeAccessLoading: state.isThemeAccessLoading,
    themeAccessErrorMessage: state.themeAccessErrorMessage,
    themeEntitlementModal: state.themeEntitlementModal,
    setPartyName: state.setPartyName,
    setPartyTitle: state.setPartyTitle,
    setPartySubtitle: state.setPartySubtitle,
    setEventDateTime: state.setEventDateTime,
    setDescription: state.setDescription,
    setPlace: state.setPlace,
    setCity: state.setCity,
    setSchedule: state.setSchedule,
    setShortDescription: state.setShortDescription,
    setExternalLinkUrl: state.setExternalLinkUrl,
    setExternalLinkText: state.setExternalLinkText,
    setDanceTags: state.setDanceTags,
    setThemeEntitlementModal: state.setThemeEntitlementModal,
  }));

  const { openModal, addNotification } = useUIStore((state) => ({
    openModal: state.openModal,
    addNotification: state.addNotification,
  }));
  const authStore = useAuthStore();
  const isAuthenticated = authStore.isAuthenticated;
  const isAuth = isAuthenticated();
  const { isOutdated: isClientOutdated, requiredVersion: clientRequiredVersion } =
    useClientOutdatedStore();

  useEffect(() => {
    if (!isPlatformInitialized() || !getPlatformCapabilities().supportsRealAuth || isAuth) {
      return;
    }

    let isMounted = true;

    const registerCallback = async () => {
      try {
        const result = (await getPlatform().invoke('auth:registerCallback')) as
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
    const store = getPartyStore();
    store.setThemeId(newThemeId);
    const next = getDefaultCustomizationSettings(newThemeId) as Record<string, unknown>;
    store.setCustomizationSettings(next);
    setPartyThemeIdInMeta(newThemeId);
    setPartyCustomizationSettingsInMeta(next);
  };

  const loadThemeAccess = useCallback(
    async (forceRefresh = false) => {
      const store = getPartyStore();
      if (!isAuth) {
        store.setThemeAccess(null);
        store.setThemeAccessErrorMessage(null);
        return;
      }

      store.setIsThemeAccessLoading(true);
      try {
        const access = await partyService.getThemeAccess(forceRefresh);
        store.setThemeAccess(access);
        store.setThemeAccessErrorMessage(null);
      } catch (error) {
        console.warn('Failed to load theme access:', error);
        store.setThemeAccess(null);
        store.setThemeAccessErrorMessage(THEME_ACCESS_FALLBACK_ERROR);
      } finally {
        store.setIsThemeAccessLoading(false);
      }
    },
    [isAuth],
  );

  const handleCustomizationSettingsChange = useCallback(
    (settings: Record<string, unknown>) => {
      getPartyStore().setCustomizationSettings(settings);
      setPartyCustomizationSettingsInMeta(settings);
    },
    [setPartyCustomizationSettingsInMeta],
  );

  useEffect(() => {
    const store = getPartyStore();
    const tid = meta.partyThemeId;
    if (tid && isValidPartyTheme(tid)) {
      store.setThemeId(tid as PartyThemeId);
      store.setCustomizationSettings(
        resolveLoadedCustomizationSettings(tid as PartyThemeId, meta.partyCustomizationSettings),
      );
    } else {
      store.setThemeId('cyberpunk');
      store.setCustomizationSettings(
        getDefaultCustomizationSettings('cyberpunk') as Record<string, unknown>,
      );
    }
  }, [meta.partyThemeId, meta.partyCustomizationSettings, projectContextKey]);

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

  const playbackState = useMemo((): PlaybackState | null => {
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
    } as PlaybackState;
  }, [
    streamingSource,
    aimpBridgeState,
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
    if (partyWorkspaceReconnectRefs.intervalId !== null) {
      clearInterval(partyWorkspaceReconnectRefs.intervalId);
      partyWorkspaceReconnectRefs.intervalId = null;
    }
  }, []);

  const loadPartyMetadata = useCallback(
    async (partyId: string) => {
      const store = getPartyStore();
      try {
        const party = await partyService.getParty(partyId);
        if (party.name) store.setPartyName(party.name);
        store.setPartyTitle(party.title ?? '');
        store.setPartySubtitle(party.subtitle ?? '');
        const resolvedThemeId: PartyThemeId =
          party.partyThemeId && isValidPartyTheme(party.partyThemeId)
            ? party.partyThemeId
            : 'cyberpunk';
        store.setThemeId(resolvedThemeId);
        const resolvedCustomization = resolveLoadedCustomizationSettings(
          resolvedThemeId,
          party.customizationSettings,
        );
        store.setCustomizationSettings(resolvedCustomization);
        setPartyThemeIdInMeta(resolvedThemeId, { skipMarkDirty: true });
        setPartyCustomizationSettingsInMeta(resolvedCustomization, { skipMarkDirty: true });
        const tz = party.timeZone || getDefaultTimeZone();
        store.setTimeZone(tz);
        if (party.eventDateTime) {
          const local = convertUtcToLocalDateTime(party.eventDateTime, tz);
          if (local) store.setEventDateTime(local);
        } else {
          store.setEventDateTime('');
        }
        if (party.eventEndDateTime) {
          const localEnd = convertUtcToLocalDateTime(party.eventEndDateTime, tz);
          if (localEnd) {
            store.setEventEndDateTime(localEnd);
            store.setHasInitialEventEndDateTime(true);
          } else {
            store.setEventEndDateTime('');
            store.setHasInitialEventEndDateTime(false);
          }
        } else {
          store.setEventEndDateTime('');
          store.setHasInitialEventEndDateTime(false);
        }
        if (party.description) store.setDescription(party.description);
        if (party.place) store.setPlace(party.place);
        if (party.city) store.setCity(party.city);
        if (party.schedule) store.setSchedule(party.schedule);
        store.setShortDescription(party.shortDescription ?? '');
        store.setExternalLinkUrl(party.externalLinkUrl ?? '');
        store.setExternalLinkText(party.externalLinkText ?? '');
        store.setDanceTags(party.danceTags ? [...new Set(party.danceTags)] : []);
        store.setEventEndDateTimeTouched(false);
        store.setPartyLifecycleState(party.partyLifecycleState);
      } catch (error) {
        console.error('Failed to load party metadata:', error);
      }
    },
    [setPartyCustomizationSettingsInMeta, setPartyThemeIdInMeta],
  );

  const handleLifecycleTransition = useCallback(
    async (targetState: PartyLifecycleState) => {
      const linkedParty = meta.linkedParty;
      if (!linkedParty || !isAuth) {
        addNotification({
          type: 'warning',
          message: 'Для смены статуса нужна привязанная вечеринка',
        });
        return;
      }

      const store = getPartyStore();
      store.setIsTransitioningLifecycle(true);
      try {
        const party = await partyService.transitionPartyLifecycle(linkedParty.id, targetState);
        store.setPartyLifecycleState(party.partyLifecycleState);
        addNotification({
          type: 'success',
          message: LIFECYCLE_TRANSITION_SUCCESS_MESSAGES[targetState],
        });
      } catch (error) {
        console.error('Failed to transition party lifecycle:', error);
        if (error instanceof InvalidPartyLifecycleTransitionError) {
          addNotification({
            type: 'error',
            message: error.message,
          });
          return;
        }
        addNotification({
          type: 'error',
          message: error instanceof Error ? error.message : 'Не удалось изменить статус вечеринки',
        });
      } finally {
        store.setIsTransitioningLifecycle(false);
      }
    },
    [meta.linkedParty, isAuth, addNotification],
  );

  const handleEventEndDateTimeChange = useCallback((value: string) => {
    const store = getPartyStore();
    store.setEventEndDateTime(value);
    store.setEventEndDateTimeTouched(true);
  }, []);

  const restoreAfterReconnect = useCallback(
    async (linkedParty: { id: string; shortCode: string }) => {
      const store = getPartyStore();
      try {
        const exists = await partyService.checkPartyExists(linkedParty.id);
        store.setPartyVerified(exists);
        if (!exists) {
          store.setServerError(ERROR_PARTY_NOT_FOUND);
          return;
        }
        store.setServerError(null);

        const url = await partyService.getPartyUrl(linkedParty.shortCode);
        setLinkedParty({ ...linkedParty, url });

        if (isAuth) {
          await loadPartyMetadata(linkedParty.id);
        }
      } catch (error) {
        console.error('Failed to restore after reconnect:', error);
        store.setServerError(ERROR_CONNECTION);
        store.setPartyVerified(false);
      }
    },
    [isAuth, loadPartyMetadata, setLinkedParty],
  );

  const startReconnectTimer = useCallback(
    (linkedParty: { id: string; shortCode: string } | null) => {
      partyWorkspaceReconnectRefs.linkedParty = linkedParty;
      if (partyWorkspaceReconnectRefs.intervalId !== null) {
        return;
      }
      partyWorkspaceReconnectRefs.cancelled = false;
      partyWorkspaceReconnectRefs.intervalId = setInterval(() => {
        void (async () => {
          const store = getPartyStore();
          if (partyWorkspaceReconnectRefs.cancelled) return;
          store.setIsReconnecting(true);
          try {
            const reachable = await partyService.checkServerReachable();
            if (partyWorkspaceReconnectRefs.cancelled) return;
            if (reachable) {
              stopReconnectTimer();
              if (!partyWorkspaceReconnectRefs.cancelled) store.setServerUnreachable(false);
              if (!partyWorkspaceReconnectRefs.cancelled) store.setLastManualCheckFailed(false);
              const activeLinkedParty = partyWorkspaceReconnectRefs.linkedParty;
              if (activeLinkedParty) {
                await restoreAfterReconnect(activeLinkedParty);
              } else {
                if (!partyWorkspaceReconnectRefs.cancelled) store.setServerError(null);
                if (!partyWorkspaceReconnectRefs.cancelled) store.setPartyVerified(false);
              }
            }
          } catch {
            void 0;
          } finally {
            if (!partyWorkspaceReconnectRefs.cancelled) store.setIsReconnecting(false);
          }
        })();
      }, RECONNECT_INTERVAL_MS);
    },
    [stopReconnectTimer, restoreAfterReconnect],
  );

  const checkPartyExists = useCallback(async (partyId: string): Promise<boolean> => {
    const store = getPartyStore();
    try {
      store.setIsCheckingParty(true);
      store.setServerError(null);
      const exists = await partyService.checkPartyExists(partyId);
      store.setPartyVerified(exists);
      if (!exists) {
        store.setServerError(ERROR_PARTY_NOT_FOUND);
      }
      return exists;
    } catch (error) {
      console.error('Failed to check party existence:', error);
      store.setServerError(ERROR_CONNECTION);
      store.setPartyVerified(false);
      return false;
    } finally {
      store.setIsCheckingParty(false);
    }
  }, []);

  const handleManualReconnect = useCallback(async () => {
    const store = getPartyStore();
    const linkedParty = meta.linkedParty;
    store.setIsReconnecting(true);
    try {
      const reachable = await partyService.checkServerReachable();
      if (reachable) {
        stopReconnectTimer();
        store.setServerUnreachable(false);
        store.setLastManualCheckFailed(false);
        if (linkedParty) {
          await restoreAfterReconnect(linkedParty);
        } else {
          store.setServerError(null);
          store.setPartyVerified(false);
        }
      } else {
        store.setLastManualCheckFailed(true);
      }
    } catch {
      store.setLastManualCheckFailed(true);
    } finally {
      store.setIsReconnecting(false);
    }
  }, [meta.linkedParty, stopReconnectTimer, restoreAfterReconnect]);

  const handleRetry = useCallback(async () => {
    const store = getPartyStore();
    if (meta.linkedParty) {
      await checkPartyExists(meta.linkedParty.id);
    } else {
      store.setServerError(null);
      store.setPartyVerified(false);
    }
  }, [meta.linkedParty, checkPartyExists]);

  const handleResetAndCreateNewParty = useCallback(() => {
    clearPartyWorkspaceLinkedPartyCheck();
    resetPartyLinkState();
    setLinkedParty(null);
    markAsDirty();
    addNotification({
      type: 'info',
      message: 'Привязка сброшена. Можно создать новую вечеринку.',
    });
  }, [setLinkedParty, markAsDirty, addNotification]);

  const prevProjectContextKeyRef = useRef(projectContextKey);
  const prevLinkedPartyRef = useRef(meta.linkedParty);

  useEffect(() => {
    if (prevProjectContextKeyRef.current === projectContextKey) {
      return;
    }
    prevProjectContextKeyRef.current = projectContextKey;
    resetPartyWorkspaceState();
    partyWorkspaceOneShotGuards.themeAccessGuardKey = null;
    partyWorkspaceOneShotGuards.loadedPartyMetadataId = null;
    clearPartyWorkspaceLinkedPartyCheck();
    partyWorkspaceReconnectRefs.linkedParty = null;
    stopReconnectTimer();
    partyWorkspaceReconnectRefs.cancelled = true;
  }, [projectContextKey, stopReconnectTimer]);

  useEffect(() => {
    const store = getPartyStore();
    const prevLinkedParty = prevLinkedPartyRef.current;
    prevLinkedPartyRef.current = meta.linkedParty;

    if (meta.linkedParty) {
      const linkedParty = meta.linkedParty;
      partyWorkspaceReconnectRefs.linkedParty = linkedParty;

      const existing = partyWorkspaceLinkedPartyCheck.inFlight;
      if (existing?.partyId === linkedParty.id) {
        store.setIsCheckingParty(true);
        void existing.promise.finally(() => {
          if (partyWorkspaceLinkedPartyCheck.inFlight?.seq === existing.seq) {
            store.setIsCheckingParty(false);
          }
        });
        return;
      }

      const seq = partyWorkspaceLinkedPartyCheck.seq + 1;
      partyWorkspaceLinkedPartyCheck.seq = seq;

      const runCheck = async (): Promise<void> => {
        store.setIsCheckingParty(true);
        store.setServerError(null);
        try {
          const reachable = await partyService.checkServerReachable();
          if (seq !== partyWorkspaceLinkedPartyCheck.seq) return;
          if (!reachable) {
            store.setServerUnreachable(true);
            store.setPartyVerified(false);
            startReconnectTimer(linkedParty);
            return;
          }
          store.setServerUnreachable(false);
          stopReconnectTimer();
          const exists = await partyService.checkPartyExists(linkedParty.id);
          if (seq !== partyWorkspaceLinkedPartyCheck.seq) return;
          store.setPartyVerified(exists);
          if (!exists) {
            store.setServerError(ERROR_PARTY_NOT_FOUND);
          }
        } catch {
          if (seq !== partyWorkspaceLinkedPartyCheck.seq) return;
          store.setServerUnreachable(true);
          store.setPartyVerified(false);
          startReconnectTimer(linkedParty);
        } finally {
          if (seq === partyWorkspaceLinkedPartyCheck.seq) {
            store.setIsCheckingParty(false);
          }
        }
      };

      const promise = runCheck();
      partyWorkspaceLinkedPartyCheck.inFlight = { partyId: linkedParty.id, seq, promise };
      void promise.finally(() => {
        if (partyWorkspaceLinkedPartyCheck.inFlight?.seq === seq) {
          partyWorkspaceLinkedPartyCheck.inFlight = null;
        }
      });
      return;
    }

    clearPartyWorkspaceLinkedPartyCheck();

    if (prevLinkedParty) {
      resetPartyLinkState();
      partyWorkspaceOneShotGuards.loadedPartyMetadataId = null;
      partyWorkspaceReconnectRefs.linkedParty = null;
      stopReconnectTimer();
      partyWorkspaceReconnectRefs.cancelled = true;
    }
  }, [meta.linkedParty, startReconnectTimer, stopReconnectTimer]);

  useEffect(() => {
    if (meta.linkedParty && isAuth) {
      const partyId = meta.linkedParty.id;
      if (partyWorkspaceOneShotGuards.loadedPartyMetadataId === partyId) {
        return;
      }
      partyWorkspaceOneShotGuards.loadedPartyMetadataId = partyId;
      void loadPartyMetadata(partyId);
    } else if (!meta.linkedParty) {
      partyWorkspaceOneShotGuards.loadedPartyMetadataId = null;
    }
  }, [meta.linkedParty, isAuth, loadPartyMetadata]);

  useEffect(() => {
    const guardKey = isAuth ? 'auth' : 'guest';
    if (partyWorkspaceOneShotGuards.themeAccessGuardKey === guardKey) {
      return;
    }
    partyWorkspaceOneShotGuards.themeAccessGuardKey = guardKey;
    void loadThemeAccess();
  }, [isAuth, loadThemeAccess]);

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

  const handleThemeNotEntitled = useCallback(
    async (error: ThemeNotEntitledError) => {
      const store = getPartyStore();
      const message = buildThemeNotEntitledMessage(error, store.themeAccess);
      const safeContactUrl = sanitizeExternalUrl(store.themeAccess?.contactUrl);

      addNotification({
        type: 'error',
        message,
        duration: 7000,
      });

      store.setThemeEntitlementModal({
        message,
        safeContactUrl,
      });

      await loadThemeAccess(true);
    },
    [addNotification, loadThemeAccess],
  );

  const handleCreateParty = async () => {
    const store = getPartyStore();
    if (!isAuth) {
      addNotification({
        type: 'warning',
        message: 'Для создания вечеринки необходимо войти в аккаунт',
        duration: 5000,
      });
      openModal('account');
      return;
    }
    if (!store.partyName.trim()) {
      addNotification({
        type: 'warning',
        message: 'Введите название вечеринки',
      });
      return;
    }

    store.setIsCreating(true);
    store.setServerError(null);
    store.setPartyVerified(false);
    try {
      const playlistForApi = buildPlaylistForApi({
        streamingSource,
        aimpPlaylistSnapshot: aimpBridgeState.playlistSnapshot,
        items,
        partyTrackDisplay,
      });

      const createData = buildCreatePartyDto(store, playlistForApi);

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
      store.setPartyVerified(true);
      store.setPartyLifecycleState(party.partyLifecycleState);
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
        store.setServerUnreachable(true);
        startReconnectTimer(null);
      } else {
        store.setServerError(ERROR_CONNECTION);
      }
      store.setPartyVerified(false);
      addNotification({
        type: 'error',
        message: 'Ошибка при создании вечеринки',
      });
    } finally {
      store.setIsCreating(false);
    }
  };

  const handlePublish = async () => {
    const store = getPartyStore();
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
      store.setIsPublishing(true);
      store.setServerError(null);
      try {
        const playlistForApi = buildPlaylistForApi({
          streamingSource,
          aimpPlaylistSnapshot: aimpBridgeState.playlistSnapshot,
          items,
          partyTrackDisplay,
        });
        await partyService.updatePartyPlaylist(linkedParty.id, playlistForApi);

        const tz = store.timeZone.trim() || getDefaultTimeZone();
        let eventEndDateTimeForUpdate: string | null | undefined = undefined;

        if (store.eventEndDateTimeTouched) {
          if (!store.eventEndDateTime.trim()) {
            eventEndDateTimeForUpdate = store.hasInitialEventEndDateTime ? null : undefined;
          } else {
            eventEndDateTimeForUpdate = convertLocalDateTimeToUtc(store.eventEndDateTime, tz);
          }
        }

        await partyService.updateParty(linkedParty.id, {
          name: store.partyName,
          title: store.partyTitle.trim() || undefined,
          subtitle: store.partySubtitle.trim() || undefined,
          partyThemeId: store.themeId,
          customizationSettings: normalizeCustomizationSettings(store.customizationSettings),
          eventDateTime: store.eventDateTime
            ? convertLocalDateTimeToUtc(store.eventDateTime, tz)
            : undefined,
          eventEndDateTime: eventEndDateTimeForUpdate,
          description: store.description.trim() || undefined,
          place: store.place.trim() || undefined,
          city: store.city.trim() || undefined,
          schedule: store.schedule.trim() || undefined,
          timeZone: store.timeZone.trim() || undefined,
          shortDescription: store.shortDescription.trim(),
          externalLinkUrl: store.externalLinkUrl.trim(),
          externalLinkText: store.externalLinkText.trim(),
          danceTags: store.danceTags,
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
        store.setIsPublishing(false);
      }
      return;
    }

    const nameToUse = store.partyName.trim() || projectName.trim() || 'Вечеринка';
    if (!store.partyName.trim()) {
      store.setPartyName(nameToUse);
    }

    store.setIsCreating(true);
    store.setServerError(null);
    store.setPartyVerified(false);
    try {
      const playlistForApi = buildPlaylistForApi({
        streamingSource,
        aimpPlaylistSnapshot: aimpBridgeState.playlistSnapshot,
        items,
        partyTrackDisplay,
      });
      const createData = buildCreatePartyDto(store, playlistForApi, { partyName: nameToUse });

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
      store.setPartyVerified(true);
      store.setPartyLifecycleState(party.partyLifecycleState);
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
        store.setServerUnreachable(true);
        startReconnectTimer(null);
      } else {
        store.setServerError(ERROR_CONNECTION);
      }
      addNotification({
        type: 'error',
        message: error instanceof Error ? error.message : 'Ошибка публикации',
      });
    } finally {
      store.setIsCreating(false);
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

  const handleTimeZoneChange = useCallback((newTz: string) => {
    const store = getPartyStore();
    const oldTz = store.timeZone.trim() || getDefaultTimeZone();
    store.setTimeZone(newTz);
    store.setEventDateTime(
      convertUtcToLocalDateTime(convertLocalDateTimeToUtc(store.eventDateTime, oldTz), newTz),
    );
    if (store.eventEndDateTime) {
      const updatedEnd = convertUtcToLocalDateTime(
        convertLocalDateTimeToUtc(store.eventEndDateTime, oldTz),
        newTz,
      );
      store.setEventEndDateTime(updatedEnd);
      store.setEventEndDateTimeTouched(true);
    }
  }, []);

  useEffect(() => {
    const wasFirstMount = partyWorkspaceReconnectRefs.effectsMountCount === 0;
    partyWorkspaceReconnectRefs.effectsMountCount++;
    if (wasFirstMount) {
      partyWorkspaceReconnectRefs.cancelled = false;
    }
    return () => {
      partyWorkspaceReconnectRefs.effectsMountCount--;
      if (partyWorkspaceReconnectRefs.effectsMountCount === 0) {
        stopReconnectTimer();
        partyWorkspaceReconnectRefs.cancelled = true;
      }
    };
  }, [stopReconnectTimer]);

  return {
    isAuth,
    isClientOutdated,
    clientRequiredVersion,
    isCheckingParty,
    serverUnreachable,
    isReconnecting,
    lastManualCheckFailed,
    handleManualReconnect,
    meta,
    partyTrackDisplay,
    setPartyTrackDisplaySettings,
    partyName,
    partyTitle,
    partySubtitle,
    themeId,
    customizationSettings,
    eventDateTime,
    eventEndDateTime,
    description,
    place,
    city,
    schedule,
    timeZone,
    shortDescription,
    externalLinkUrl,
    externalLinkText,
    danceTags,
    isCreating,
    isPublishing,
    partyLifecycleState,
    isTransitioningLifecycle,
    serverError,
    themeAccess,
    isThemeAccessLoading,
    themeAccessErrorMessage,
    themeEntitlementModal,
    setPartyName,
    setPartyTitle,
    setPartySubtitle,
    setEventDateTime,
    setDescription,
    setPlace,
    setCity,
    setSchedule,
    setShortDescription,
    setExternalLinkUrl,
    setExternalLinkText,
    setDanceTags,
    setThemeEntitlementModal,
    handleThemeChange,
    handleCustomizationSettingsChange,
    handleEventEndDateTimeChange,
    handleTimeZoneChange,
    handleCreateParty,
    handlePublish,
    handleCopyUrl,
    handleRetry,
    handleResetAndCreateNewParty,
    handleLifecycleTransition,
    openModal,
    lockedThemeInfos,
    visibleThemeIds,
    previewPlaylistData,
    playbackState,
  };
}
