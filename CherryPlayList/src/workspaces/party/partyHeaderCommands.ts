import {
  InvalidPartyLifecycleTransitionError,
  ThemeNotEntitledError,
  partyService,
} from '@shared/services/partyService';
import {
  useAimpStore,
  useAuthStore,
  usePlayerAudioStore,
  useProjectStore,
  useSettingsStore,
  useUIStore,
} from '@shared/stores';
import { applySyncedPlaylistTrackIds, getOnlineNetworkPolicy } from '@shared/streaming';
import { sanitizeExternalUrl } from '@shared/utils';
import { isSessionExpiredError } from '@shared/utils/authErrorHandler';

import { resolvePartyPlaybackSourceState } from './partyPlaybackSource';
import {
  getCurrentPartyPublishSyncParts,
  markPartyPublishFullySynced,
  resolveHeaderPartyPublishHighlight,
} from './partyPublishSync';
import { loadPartyThemeAccess } from './partyThemeAccessLoad';
import { buildPlaylistForApi, buildUpdatePartyDto } from './partyWorkspaceApiBuilders';
import { usePartyWorkspaceStore } from './partyWorkspaceStore';
import { buildThemeNotEntitledMessage, isThemeNotEntitledError } from './partyWorkspaceUtils';
import {
  hasNoPendingPartyPublishChanges,
  resolveHeaderPartyPublishDisabledReason,
} from './resolveHeaderPartyPublishDisabledReason';
import { resolvePartyArchiveAvailability } from './resolvePartyArchiveAvailability';

const getPartyStore = () => {
  return usePartyWorkspaceStore.getState();
};

const isNetworkEnabledNow = (): boolean => {
  return getOnlineNetworkPolicy({
    enableStreaming: useSettingsStore.getState().enableStreaming,
  }).networkEnabled;
};

const buildPlaylistParamsFromStores = () => {
  const project = useProjectStore.getState();
  return {
    streamingSource: useSettingsStore.getState().streamingSource,
    aimpPlaylistSnapshot: useAimpStore.getState().bridgeState.playlistSnapshot,
    items: project.items,
    partyTrackDisplay: project.meta.partyTrackDisplay,
  };
};

const handleThemeNotEntitled = (error: ThemeNotEntitledError): void => {
  const store = getPartyStore();
  const message = buildThemeNotEntitledMessage(error, store.themeAccess);
  const safeContactUrl = sanitizeExternalUrl(store.themeAccess?.contactUrl);
  useUIStore.getState().addNotification({
    type: 'error',
    message,
    duration: 7000,
  });
  store.setThemeEntitlementModal({
    message,
    safeContactUrl,
  });
};

export const refreshPartyThemeAccess = async (forceRefresh = false): Promise<void> => {
  await loadPartyThemeAccess(forceRefresh);
};

export const publishPartyToSite = async (): Promise<void> => {
  const store = getPartyStore();
  const ui = useUIStore.getState();
  const networkEnabled = isNetworkEnabledNow();
  const isAuth = useAuthStore.getState().isAuthenticated();
  const linkedParty = useProjectStore.getState().meta.linkedParty;

  const hasSyncBaseline = store.lastSyncedPublishParts != null;
  const isOutOfSync = resolveHeaderPartyPublishHighlight({
    hasLinkedParty: Boolean(linkedParty),
    partyLifecycleState: store.partyLifecycleState,
    lastSynced: store.lastSyncedPublishParts,
    current: getCurrentPartyPublishSyncParts(),
  });
  if (
    hasNoPendingPartyPublishChanges({
      hasLinkedParty: Boolean(linkedParty),
      partyLifecycleState: store.partyLifecycleState,
      hasSyncBaseline,
      isOutOfSync,
    })
  ) {
    return;
  }

  const disabledReason = resolveHeaderPartyPublishDisabledReason({
    isAuthenticated: isAuth,
    networkEnabled,
    hasLinkedParty: Boolean(linkedParty),
    partyLifecycleState: store.partyLifecycleState,
  });
  if (disabledReason) {
    if (!isAuth) {
      ui.openModal('account');
    }
    ui.addNotification({
      type: 'warning',
      message: disabledReason,
    });
    return;
  }

  if (!linkedParty) {
    return;
  }

  store.setIsPublishing(true);
  store.setServerError(null);
  try {
    const playlistForApi = buildPlaylistForApi(buildPlaylistParamsFromStores());
    await partyService.updatePartyPlaylist(linkedParty.id, playlistForApi);
    applySyncedPlaylistTrackIds(playlistForApi);
    await partyService.updateParty(linkedParty.id, buildUpdatePartyDto(store));
    await refreshPartyThemeAccess(true);
    markPartyPublishFullySynced();
    ui.addNotification({
      type: 'success',
      message: 'Плейлист и настройки обновлены на сайте',
    });
  } catch (error) {
    console.error('Failed to publish playlist:', error);
    if (isSessionExpiredError(error)) {
      return;
    }
    if (isThemeNotEntitledError(error)) {
      handleThemeNotEntitled(error);
      return;
    }
    ui.addNotification({
      type: 'error',
      message: error instanceof Error ? error.message : 'Ошибка публикации',
    });
  } finally {
    store.setIsPublishing(false);
  }
};

export const publishPartyFromHeader = async (): Promise<void> => {
  await publishPartyToSite();
};

export const unarchivePartyFromHeader = async (): Promise<void> => {
  const store = getPartyStore();
  const ui = useUIStore.getState();
  const networkEnabled = isNetworkEnabledNow();
  const isAuth = useAuthStore.getState().isAuthenticated();
  const linkedParty = useProjectStore.getState().meta.linkedParty;

  if (!networkEnabled) {
    ui.addNotification({
      type: 'warning',
      message: 'Вернуть из архива нельзя: включите «Онлайн» в настройках',
    });
    return;
  }
  if (!isAuth) {
    ui.addNotification({
      type: 'warning',
      message: 'Для смены статуса необходимо войти в аккаунт',
    });
    ui.openModal('account');
    return;
  }
  if (!linkedParty) {
    ui.addNotification({
      type: 'warning',
      message: 'Нет привязанной вечеринки',
    });
    return;
  }
  if (!window.confirm('Вернуть вечеринку из архива в статус «Ждёт начала»?')) {
    return;
  }

  store.setPendingLifecycleTransition('ready');
  store.setIsTransitioningLifecycle(true);
  try {
    const party = await partyService.transitionPartyLifecycle(linkedParty.id, 'ready');
    store.setPartyLifecycleState(party.partyLifecycleState);
  } catch (error) {
    console.error('Failed to unarchive party from header:', error);
    if (isSessionExpiredError(error)) {
      return;
    }
    if (error instanceof InvalidPartyLifecycleTransitionError) {
      ui.addNotification({
        type: 'error',
        message: error.message,
      });
      return;
    }
    ui.addNotification({
      type: 'error',
      message: error instanceof Error ? error.message : 'Не удалось вернуть вечеринку из архива',
    });
  } finally {
    store.setIsTransitioningLifecycle(false);
    store.setPendingLifecycleTransition(null);
  }
};

export const archivePartyFromHeader = async (): Promise<void> => {
  const store = getPartyStore();
  const ui = useUIStore.getState();
  const networkEnabled = isNetworkEnabledNow();
  const isAuth = useAuthStore.getState().isAuthenticated();
  const linkedParty = useProjectStore.getState().meta.linkedParty;

  if (!networkEnabled) {
    ui.addNotification({
      type: 'warning',
      message: 'Отправить в архив нельзя: включите «Онлайн» в настройках',
    });
    return;
  }
  if (!isAuth) {
    ui.addNotification({
      type: 'warning',
      message: 'Для смены статуса необходимо войти в аккаунт',
    });
    ui.openModal('account');
    return;
  }
  if (!linkedParty) {
    ui.addNotification({
      type: 'warning',
      message: 'Нет привязанной вечеринки',
    });
    return;
  }
  if (store.isTransitioningLifecycle) {
    ui.addNotification({
      type: 'warning',
      message: 'Смена статуса уже выполняется',
    });
    return;
  }

  const sessionMode = useProjectStore.getState().sessionState.mode;
  const playbackStatus = usePlayerAudioStore.getState().status;
  const streamingSource = useSettingsStore.getState().streamingSource;
  const aimpBridge = useAimpStore.getState().bridgeState;
  const availability = resolvePartyArchiveAvailability({
    partyLifecycleState: store.partyLifecycleState,
    playbackSourceState: resolvePartyPlaybackSourceState(streamingSource, {
      sessionMode,
      playerPlaybackStatus: playbackStatus,
      aimpBridgeState: aimpBridge,
    }),
  });

  if (availability.isBlockedByLive) {
    window.alert(availability.blockedExplanation ?? 'Сейчас нельзя отправить вечеринку в архив');
    return;
  }
  if (!availability.canArchive || store.partyLifecycleState !== 'ready') {
    ui.addNotification({
      type: 'warning',
      message: 'Сейчас нельзя отправить вечеринку в архив',
    });
    return;
  }
  store.setPendingLifecycleTransition('completed');
  store.setIsTransitioningLifecycle(true);
  try {
    const party = await partyService.transitionPartyLifecycle(linkedParty.id, 'completed');
    store.setPartyLifecycleState(party.partyLifecycleState);
  } catch (error) {
    console.error('Failed to archive party from header:', error);
    if (isSessionExpiredError(error)) {
      return;
    }
    if (error instanceof InvalidPartyLifecycleTransitionError) {
      ui.addNotification({
        type: 'error',
        message: error.message,
      });
      return;
    }
    ui.addNotification({
      type: 'error',
      message: error instanceof Error ? error.message : 'Не удалось отправить вечеринку в архив',
    });
  } finally {
    store.setIsTransitioningLifecycle(false);
    store.setPendingLifecycleTransition(null);
  }
};
