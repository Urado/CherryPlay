/**
 * Party metadata subsystem — explicit server actions (create, publish, lifecycle, bind).
 *
 * REST writes here: `createParty`, `updateParty`, `updatePartyPlaylist` (explicit Publish),
 * `transitionPartyLifecycle`. Live playlist PUT during broadcast is owned by Site Streamer
 * (`partyPlaylistSync` via orchestrator), not Player workspace effects.
 */

import { useCallback } from 'react';

import {
  InvalidPartyLifecycleTransitionError,
  ThemeNotEntitledError,
  partyService,
  type PartyLifecycleState,
} from '@shared/services/partyService';
import { useAuthStore, useClientOutdatedStore, useProjectStore, useUIStore } from '@shared/stores';
import { sanitizeExternalUrl } from '@shared/utils';

import {
  buildCreatePartyDto,
  buildPlaylistForApi,
  buildUpdatePartyDto,
} from './partyWorkspaceApiBuilders';
import { finalizePartyCreation, handlePartyCreationFailure } from './partyWorkspaceCreateFlow';
import { usePartyWorkspaceStore } from './partyWorkspaceStore';
import { buildThemeNotEntitledMessage, isThemeNotEntitledError } from './partyWorkspaceUtils';
import type { PartyPlaylistBuildParams } from './usePartyPlaylistState';

const LIFECYCLE_TRANSITION_SUCCESS_MESSAGES: Record<PartyLifecycleState, string> = {
  draft: 'Вечеринка снята с сайта',
  ready: 'Вечеринка на сайте, готова к гостям',
  completed: 'Вечеринка в архиве',
};

const getPartyStore = () => usePartyWorkspaceStore.getState();

function resolvePartyNameForServer(
  store: ReturnType<typeof getPartyStore>,
  projectName: string,
): string {
  const nameToUse = store.partyName.trim() || projectName.trim() || 'Вечеринка';
  if (!store.partyName.trim()) {
    store.setPartyName(nameToUse);
  }
  return nameToUse;
}

type PartyServerEffects = {
  loadThemeAccess: (forceRefresh?: boolean) => Promise<void>;
  checkPartyExists: (partyId: string) => Promise<boolean>;
  startReconnectTimer: (linkedParty: { id: string; shortCode: string } | null) => void;
  isNetworkEnabled: () => boolean;
};

export function usePartyServerActions(
  isAuth: boolean,
  playlistBuildParams: PartyPlaylistBuildParams,
  effects: PartyServerEffects,
) {
  const meta = useProjectStore((state) => state.meta);
  const projectName = useProjectStore((state) => state.name);
  const setLinkedParty = useProjectStore((state) => state.setLinkedParty);
  const markAsDirty = useProjectStore((state) => state.markAsDirty);

  const { openModal, addNotification } = useUIStore((state) => ({
    openModal: state.openModal,
    addNotification: state.addNotification,
  }));

  const buildCurrentPlaylistForApi = useCallback(
    () => buildPlaylistForApi(playlistBuildParams),
    [playlistBuildParams],
  );

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

      await effects.loadThemeAccess(true);
    },
    [addNotification, effects],
  );

  const handleCatalogVisibilityChange = useCallback(
    async (listed: boolean) => {
      const store = getPartyStore();
      const previous = store.isListedInCatalog;
      store.setIsListedInCatalog(listed);

      const linkedParty = meta.linkedParty;
      if (!linkedParty || !isAuth) {
        return;
      }

      store.setIsTogglingCatalogVisibility(true);
      try {
        await partyService.updateParty(linkedParty.id, { isListedInCatalog: listed });
      } catch (error) {
        console.error('Failed to update catalog visibility:', error);
        store.setIsListedInCatalog(previous);
        addNotification({
          type: 'error',
          message:
            error instanceof Error ? error.message : 'Не удалось изменить видимость в каталоге',
        });
      } finally {
        store.setIsTogglingCatalogVisibility(false);
      }
    },
    [meta.linkedParty, isAuth, addNotification],
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

  const handleCreateParty = useCallback(async () => {
    const store = getPartyStore();
    if (!effects.isNetworkEnabled()) {
      addNotification({
        type: 'warning',
        message: 'Создание недоступно: включите «Онлайн» в настройках',
      });
      return;
    }
    if (store.serverUnreachable) {
      addNotification({
        type: 'warning',
        message: 'Создание недоступно: сервер сейчас не отвечает',
      });
      return;
    }
    if (!isAuth) {
      addNotification({
        type: 'warning',
        message: 'Для создания вечеринки необходимо войти в аккаунт',
        duration: 5000,
      });
      openModal('account');
      return;
    }
    const nameToUse = resolvePartyNameForServer(store, projectName);

    store.setIsCreating(true);
    store.setServerError(null);
    store.setPartyVerified(false);
    try {
      const createData = buildCreatePartyDto(store, buildCurrentPlaylistForApi(), {
        partyName: nameToUse,
      });
      await finalizePartyCreation(store, createData, 'Вечеринка успешно создана', {
        loadThemeAccess: effects.loadThemeAccess,
        checkPartyExists: effects.checkPartyExists,
        setLinkedParty,
        markAsDirty,
        addNotification,
      });
    } catch (error) {
      console.error('Failed to create party:', error);
      if (isThemeNotEntitledError(error)) {
        await handleThemeNotEntitled(error);
        return;
      }
      await handlePartyCreationFailure(
        store,
        {
          addNotification,
          startReconnectTimer: effects.startReconnectTimer,
        },
        'Ошибка при создании вечеринки',
      );
    } finally {
      store.setIsCreating(false);
    }
  }, [
    isAuth,
    addNotification,
    openModal,
    buildCurrentPlaylistForApi,
    effects,
    projectName,
    setLinkedParty,
    markAsDirty,
    handleThemeNotEntitled,
  ]);

  const handlePublish = useCallback(async () => {
    const store = getPartyStore();
    if (!effects.isNetworkEnabled()) {
      addNotification({
        type: 'warning',
        message: 'Публикация недоступна: включите «Онлайн» в настройках',
      });
      return;
    }
    if (store.serverUnreachable) {
      addNotification({
        type: 'warning',
        message: 'Публикация недоступна: сервер сейчас не отвечает',
      });
      return;
    }
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
        const playlistForApi = buildCurrentPlaylistForApi();
        await partyService.updatePartyPlaylist(linkedParty.id, playlistForApi);
        await partyService.updateParty(linkedParty.id, buildUpdatePartyDto(store));
        await effects.loadThemeAccess(true);

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

    const nameToUse = resolvePartyNameForServer(store, projectName);

    store.setIsCreating(true);
    store.setServerError(null);
    store.setPartyVerified(false);
    try {
      const createData = buildCreatePartyDto(store, buildCurrentPlaylistForApi(), {
        partyName: nameToUse,
      });
      await finalizePartyCreation(store, createData, 'Вечеринка создана и опубликована', {
        loadThemeAccess: effects.loadThemeAccess,
        checkPartyExists: effects.checkPartyExists,
        setLinkedParty,
        markAsDirty,
        addNotification,
      });
    } catch (error) {
      console.error('Failed to publish:', error);
      if (isThemeNotEntitledError(error)) {
        await handleThemeNotEntitled(error);
        return;
      }
      await handlePartyCreationFailure(
        store,
        {
          addNotification,
          startReconnectTimer: effects.startReconnectTimer,
        },
        error instanceof Error ? error.message : 'Ошибка публикации',
      );
    } finally {
      store.setIsCreating(false);
    }
  }, [
    isAuth,
    meta.linkedParty,
    addNotification,
    openModal,
    buildCurrentPlaylistForApi,
    effects,
    projectName,
    setLinkedParty,
    markAsDirty,
    handleThemeNotEntitled,
  ]);

  const handleCopyUrl = useCallback(async () => {
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
  }, [meta.linkedParty?.url, addNotification]);

  return {
    handleCreateParty,
    handlePublish,
    handleCopyUrl,
    handleCatalogVisibilityChange,
    handleLifecycleTransition,
  };
}

export function usePartyWorkspaceAuthState() {
  const authStore = useAuthStore();
  const isAuth = authStore.isAuthenticated();
  const { isOutdated: isClientOutdated, requiredVersion: clientRequiredVersion } =
    useClientOutdatedStore();

  return { isAuth, isClientOutdated, clientRequiredVersion };
}
