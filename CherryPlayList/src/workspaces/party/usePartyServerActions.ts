import { useCallback } from 'react';

import {
  InvalidPartyLifecycleTransitionError,
  ThemeNotEntitledError,
  partyService,
  type PartyLifecycleState,
} from '@shared/services/partyService';
import { useAuthStore, useClientOutdatedStore, useProjectStore, useUIStore } from '@shared/stores';
import { copyTextToClipboard, sanitizeExternalUrl } from '@shared/utils';

import { publishPartyToSite } from './partyHeaderCommands';
import {
  markPartyPublishCatalogVisibilitySynced,
  markPartyPublishMetadataSynced,
} from './partyPublishSync';
import {
  buildCreatePartyDto,
  buildPlaylistForApi,
  buildUpdatePartyDto,
} from './partyWorkspaceApiBuilders';
import { finalizePartyCreation, handlePartyCreationFailure } from './partyWorkspaceCreateFlow';
import { usePartyWorkspaceStore } from './partyWorkspaceStore';
import {
  buildThemeNotEntitledMessage,
  isThemeGranted,
  isThemeNotEntitledError,
  resolveDisplayPartyName,
} from './partyWorkspaceUtils';
import type { PartyPlaylistBuildParams } from './usePartyPlaylistState';

const getPartyStore = () => usePartyWorkspaceStore.getState();

function resolvePartyNameForServer(
  store: ReturnType<typeof getPartyStore>,
  projectName: string,
): string {
  const nameToUse = resolveDisplayPartyName(store.partyName, projectName, 'Вечеринка');
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
        markPartyPublishCatalogVisibilitySynced(listed);
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
      store.setPendingLifecycleTransition(targetState);
      store.setIsTransitioningLifecycle(true);
      try {
        const party = await partyService.transitionPartyLifecycle(linkedParty.id, targetState);
        store.setPartyLifecycleState(party.partyLifecycleState);
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
        store.setPendingLifecycleTransition(null);
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
    if (!isAuth) {
      addNotification({
        type: 'warning',
        message: 'Для создания вечеринки необходимо войти в аккаунт',
        duration: 5000,
      });
      openModal('account');
      return;
    }
    if (store.themeAccess !== null && !isThemeGranted(store.themeId, store.themeAccess)) {
      addNotification({
        type: 'error',
        message: 'У вас нет доступа к выбранной теме. Выберите доступную тему.',
        duration: 7000,
      });
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
      await finalizePartyCreation(store, createData, {
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
    await publishPartyToSite();
  }, []);

  const handleSaveMetadata = useCallback(async () => {
    const store = getPartyStore();
    if (!effects.isNetworkEnabled()) {
      addNotification({
        type: 'warning',
        message: 'Сохранение недоступно: включите «Онлайн» в настройках',
      });
      return;
    }
    if (!isAuth) {
      addNotification({
        type: 'warning',
        message: 'Для сохранения необходимо войти в аккаунт',
        duration: 5000,
      });
      openModal('account');
      return;
    }

    const linkedParty = meta.linkedParty;
    if (!linkedParty) {
      addNotification({
        type: 'warning',
        message: 'Сначала создайте или привяжите вечеринку',
      });
      return;
    }

    store.setIsSavingMetadata(true);
    store.setServerError(null);
    try {
      await partyService.updateParty(linkedParty.id, buildUpdatePartyDto(store));
      await effects.loadThemeAccess(true);
      markPartyPublishMetadataSynced();
      addNotification({
        type: 'success',
        message: 'Настройки вечеринки сохранены',
      });
    } catch (error) {
      console.error('Failed to save party metadata:', error);
      if (isThemeNotEntitledError(error)) {
        await handleThemeNotEntitled(error);
        return;
      }
      addNotification({
        type: 'error',
        message: error instanceof Error ? error.message : 'Не удалось сохранить настройки',
      });
    } finally {
      store.setIsSavingMetadata(false);
    }
  }, [isAuth, meta.linkedParty, addNotification, openModal, effects, handleThemeNotEntitled]);

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
      await copyTextToClipboard(url);
      addNotification({
        type: 'success',
        message: 'URL скопирован',
      });
    } catch (error) {
      console.error('Failed to copy URL:', error);
      addNotification({
        type: 'error',
        message: 'Не удалось скопировать URL. Скопируйте ссылку вручную.',
      });
    }
  }, [meta.linkedParty?.url, addNotification]);

  return {
    handleCreateParty,
    handlePublish,
    handleSaveMetadata,
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
