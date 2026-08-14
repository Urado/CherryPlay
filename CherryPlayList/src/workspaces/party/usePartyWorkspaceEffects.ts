import {
  DEFAULT_PARTY_THEME_ID,
  partyThemes,
  type PartyThemeId,
  getDefaultCustomizationSettings,
  isValidPartyTheme,
  convertUtcToLocalDateTime,
  convertLocalDateTimeToUtc,
  getDefaultTimeZone,
} from '@cherryplay/components';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import { getPlatform, getPlatformCapabilities, isPlatformInitialized } from '@shared/platform';
import { authService } from '@shared/services/authService';
import { partyService } from '@shared/services/partyService';
import { useAuthStore, useProjectStore, useUIStore } from '@shared/stores';
import { setAuthSessionToken } from '@shared/utils/authSession';

import { markPartyPublishFullySynced } from './partyPublishSync';
import { invalidatePartyThemeAccessLoads, loadPartyThemeAccess } from './partyThemeAccessLoad';
import {
  clearPartyWorkspaceLinkedPartyCheck,
  partyWorkspaceLinkedPartyCheck,
  partyWorkspaceOneShotGuards,
  partyWorkspaceReconnectRefs,
} from './partyWorkspaceReconnectRefs';
import { resetPartyLinkState, usePartyWorkspaceStore } from './partyWorkspaceStore';
import {
  ERROR_CONNECTION,
  ERROR_PARTY_NOT_FOUND,
  RECONNECT_INTERVAL_MS,
  resolveLoadedCustomizationSettings,
  REVOKED_THEME_PACKAGE_CODE,
  REVOKED_THEME_PACKAGE_NAME,
  THEME_ACCESS_POLL_INTERVAL_MS,
} from './partyWorkspaceUtils';
import { resetPartyWorkspaceForFreshProject } from './resetPartyWorkspaceForFreshProject';

const getPartyStore = () => usePartyWorkspaceStore.getState();

export function usePartyWorkspaceEffects(isAuth: boolean, networkEnabled: boolean) {
  const meta = useProjectStore((state) => state.meta);
  const projectIdentityKey = useProjectStore((state) => state.meta.filePath ?? '');
  const setLinkedParty = useProjectStore((state) => state.setLinkedParty);
  const markAsDirty = useProjectStore((state) => state.markAsDirty);
  const setPartyThemeIdInMeta = useProjectStore((state) => state.setPartyThemeId);
  const setPartyCustomizationSettingsInMeta = useProjectStore(
    (state) => state.setPartyCustomizationSettings,
  );

  const themeId = usePartyWorkspaceStore((state) => state.themeId);
  const themeAccess = usePartyWorkspaceStore((state) => state.themeAccess);

  const { addNotification } = useUIStore((state) => ({
    addNotification: state.addNotification,
  }));
  const authStore = useAuthStore();

  useEffect(() => {
    if (!isPlatformInitialized() || !getPlatformCapabilities().supportsRealAuth || isAuth) {
      return;
    }
    if (partyWorkspaceOneShotGuards.oauthCallbackRegistered) {
      return;
    }
    partyWorkspaceOneShotGuards.oauthCallbackRegistered = true;

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

    void registerCallback();

    return () => {
      isMounted = false;
    };
  }, [isAuth, authStore, addNotification]);

  const prevIsAuthRef = useRef(isAuth);
  useEffect(() => {
    if (prevIsAuthRef.current && !isAuth) {
      partyWorkspaceOneShotGuards.oauthCallbackRegistered = false;
    }
    prevIsAuthRef.current = isAuth;
  }, [isAuth]);

  const handleThemeChange = useCallback(
    (newThemeId: PartyThemeId) => {
      const store = getPartyStore();
      store.setThemeId(newThemeId);
      const next = getDefaultCustomizationSettings(newThemeId) as Record<string, unknown>;
      store.setCustomizationSettings(next);
      setPartyThemeIdInMeta(newThemeId);
      setPartyCustomizationSettingsInMeta(next);
    },
    [setPartyCustomizationSettingsInMeta, setPartyThemeIdInMeta],
  );

  const loadThemeAccess = useCallback(async (forceRefresh = false) => {
    await loadPartyThemeAccess(forceRefresh);
  }, []);

  const handleCustomizationSettingsChange = useCallback(
    (settings: Record<string, unknown>) => {
      const store = getPartyStore();
      store.setCustomizationSettings(settings);
      setPartyCustomizationSettingsInMeta(settings);
      const metaThemeId = useProjectStore.getState().meta.partyThemeId;
      if (!metaThemeId || !isValidPartyTheme(metaThemeId)) {
        setPartyThemeIdInMeta(store.themeId);
      }
    },
    [setPartyCustomizationSettingsInMeta, setPartyThemeIdInMeta],
  );

  const stopReconnectTimer = useCallback(() => {
    if (partyWorkspaceReconnectRefs.intervalId !== null) {
      clearInterval(partyWorkspaceReconnectRefs.intervalId);
      partyWorkspaceReconnectRefs.intervalId = null;
    }
  }, []);

  const loadPartyMetadata = useCallback(
    async (partyId: string) => {
      if (!networkEnabled) {
        return;
      }
      const store = getPartyStore();
      try {
        const party = await partyService.getParty(partyId);
        if (party.name) store.setPartyName(party.name);
        store.setPartyTitle(party.title ?? '');
        store.setPartySubtitle(party.subtitle ?? '');
        const resolvedThemeId: PartyThemeId =
          party.partyThemeId && isValidPartyTheme(party.partyThemeId)
            ? party.partyThemeId
            : DEFAULT_PARTY_THEME_ID;
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
        store.setIsListedInCatalog(party.isListedInCatalog ?? false);
        markPartyPublishFullySynced();
      } catch (error) {
        console.error('Failed to load party metadata:', error);
      }
    },
    [networkEnabled, setPartyCustomizationSettingsInMeta, setPartyThemeIdInMeta],
  );

  const restoreAfterReconnect = useCallback(
    async (linkedParty: { id: string; shortCode: string }) => {
      if (!networkEnabled) {
        return;
      }
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
          await loadThemeAccess(true);
          await loadPartyMetadata(linkedParty.id);
        }
      } catch (error) {
        console.error('Failed to restore after reconnect:', error);
        store.setServerError(ERROR_CONNECTION);
        store.setPartyVerified(false);
      }
    },
    [isAuth, loadPartyMetadata, loadThemeAccess, networkEnabled, setLinkedParty],
  );

  const startReconnectTimer = useCallback(
    (linkedParty: { id: string; shortCode: string } | null) => {
      if (!networkEnabled) {
        return;
      }
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
                if (isAuth) {
                  await loadThemeAccess(true);
                }
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
    [networkEnabled, stopReconnectTimer, restoreAfterReconnect, isAuth, loadThemeAccess],
  );

  const checkPartyExists = useCallback(
    async (partyId: string): Promise<boolean> => {
      const store = getPartyStore();
      if (!networkEnabled) {
        return false;
      }
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
    },
    [networkEnabled],
  );

  const handleManualReconnect = useCallback(async () => {
    if (!networkEnabled) {
      return;
    }
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
          if (isAuth) {
            await loadThemeAccess(true);
          }
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
  }, [
    meta.linkedParty,
    networkEnabled,
    stopReconnectTimer,
    restoreAfterReconnect,
    isAuth,
    loadThemeAccess,
  ]);

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
  }, [setLinkedParty, markAsDirty]);

  const handleEventEndDateTimeChange = useCallback((value: string) => {
    const store = getPartyStore();
    store.setEventEndDateTime(value);
    store.setEventEndDateTimeTouched(true);
  }, []);

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

  const prevProjectIdentityKeyRef = useRef(projectIdentityKey);
  const prevLinkedPartyRef = useRef(meta.linkedParty);

  useEffect(() => {
    if (prevProjectIdentityKeyRef.current === projectIdentityKey) {
      return;
    }
    prevProjectIdentityKeyRef.current = projectIdentityKey;
    resetPartyWorkspaceForFreshProject();
    stopReconnectTimer();
  }, [projectIdentityKey, stopReconnectTimer]);

  useEffect(() => {
    const store = getPartyStore();
    const resolvedThemeId: PartyThemeId =
      meta.partyThemeId && isValidPartyTheme(meta.partyThemeId)
        ? meta.partyThemeId
        : DEFAULT_PARTY_THEME_ID;
    store.setThemeId(resolvedThemeId);
    store.setCustomizationSettings(
      resolveLoadedCustomizationSettings(resolvedThemeId, meta.partyCustomizationSettings),
    );
  }, [meta.partyThemeId, meta.partyCustomizationSettings, projectIdentityKey]);

  useEffect(() => {
    if (networkEnabled) {
      return;
    }

    const store = getPartyStore();
    clearPartyWorkspaceLinkedPartyCheck();
    stopReconnectTimer();
    partyWorkspaceReconnectRefs.cancelled = true;
    store.setIsReconnecting(false);
    store.setIsCheckingParty(false);
    store.setServerUnreachable(false);
  }, [networkEnabled, stopReconnectTimer]);

  useEffect(() => {
    const store = getPartyStore();
    const prevLinkedParty = prevLinkedPartyRef.current;
    prevLinkedPartyRef.current = meta.linkedParty;

    if (meta.linkedParty) {
      const linkedParty = meta.linkedParty;
      partyWorkspaceReconnectRefs.linkedParty = linkedParty;

      if (!networkEnabled) {
        return;
      }

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
  }, [meta.linkedParty, networkEnabled, startReconnectTimer, stopReconnectTimer]);

  useEffect(() => {
    if (!networkEnabled) {
      return;
    }
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
  }, [meta.linkedParty, isAuth, loadPartyMetadata, networkEnabled]);

  useEffect(() => {
    if (!networkEnabled || !isAuth) {
      invalidatePartyThemeAccessLoads();
      return;
    }
    void loadThemeAccess();
    const intervalId = setInterval(() => {
      void loadThemeAccess(true);
    }, THEME_ACCESS_POLL_INTERVAL_MS);
    return () => {
      clearInterval(intervalId);
    };
  }, [isAuth, loadThemeAccess, networkEnabled]);

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

  const visibleThemeIds: PartyThemeId[] | null = useMemo(() => {
    if (!themeAccess) {
      const safe = new Set<PartyThemeId>([DEFAULT_PARTY_THEME_ID]);
      if (isValidPartyTheme(themeId)) {
        safe.add(themeId);
      }
      return partyThemes.map((theme) => theme.id).filter((id) => safe.has(id));
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

  return {
    handleThemeChange,
    handleCustomizationSettingsChange,
    handleEventEndDateTimeChange,
    handleTimeZoneChange,
    loadThemeAccess,
    loadPartyMetadata,
    checkPartyExists,
    startReconnectTimer,
    handleManualReconnect,
    handleRetry,
    handleResetAndCreateNewParty,
    visibleThemeIds,
    lockedThemeInfos,
  };
}
