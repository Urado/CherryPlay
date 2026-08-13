import {
  InvalidPartyLifecycleTransitionError,
  ThemeNotEntitledError,
  partyService,
} from '@shared/services/partyService';
import {
  useAimpStore,
  useAuthStore,
  useProjectStore,
  useSettingsStore,
  useUIStore,
} from '@shared/stores';
import { getOnlineNetworkPolicy } from '@shared/streaming';
import { sanitizeExternalUrl } from '@shared/utils';

import { markPartyPublishFullySynced } from './partyPublishSync';
import { loadPartyThemeAccess } from './partyThemeAccessLoad';
import { buildPlaylistForApi, buildUpdatePartyDto } from './partyWorkspaceApiBuilders';
import { usePartyWorkspaceStore } from './partyWorkspaceStore';
import { buildThemeNotEntitledMessage, isThemeNotEntitledError } from './partyWorkspaceUtils';
import { resolveHeaderPartyPublishDisabledReason } from './resolveHeaderPartyPublishDisabledReason';

function getPartyStore() {
  return usePartyWorkspaceStore.getState();
}

function isNetworkEnabledNow(): boolean {
  return getOnlineNetworkPolicy({
    enableStreaming: useSettingsStore.getState().enableStreaming,
  }).networkEnabled;
}

function buildPlaylistParamsFromStores() {
  const project = useProjectStore.getState();
  return {
    streamingSource: useSettingsStore.getState().streamingSource,
    aimpPlaylistSnapshot: useAimpStore.getState().bridgeState.playlistSnapshot,
    items: project.items,
    partyTrackDisplay: project.meta.partyTrackDisplay,
  };
}

async function handleThemeNotEntitled(error: ThemeNotEntitledError): Promise<void> {
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
}

export async function refreshPartyThemeAccess(forceRefresh = false): Promise<void> {
  await loadPartyThemeAccess(forceRefresh);
}

export async function publishPartyToSite(): Promise<void> {
  const store = getPartyStore();
  const ui = useUIStore.getState();
  const networkEnabled = isNetworkEnabledNow();
  const isAuth = useAuthStore.getState().isAuthenticated();
  const linkedParty = useProjectStore.getState().meta.linkedParty;

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
    await partyService.updateParty(linkedParty.id, buildUpdatePartyDto(store));
    await refreshPartyThemeAccess(true);
    markPartyPublishFullySynced();
    ui.addNotification({
      type: 'success',
      message: 'Плейлист и настройки обновлены на сайте',
    });
  } catch (error) {
    console.error('Failed to publish playlist:', error);
    if (isThemeNotEntitledError(error)) {
      await handleThemeNotEntitled(error);
      return;
    }
    ui.addNotification({
      type: 'error',
      message: error instanceof Error ? error.message : 'Ошибка публикации',
    });
  } finally {
    store.setIsPublishing(false);
  }
}

export async function publishPartyFromHeader(): Promise<void> {
  await publishPartyToSite();
}

export async function unarchivePartyFromHeader(): Promise<void> {
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
}
