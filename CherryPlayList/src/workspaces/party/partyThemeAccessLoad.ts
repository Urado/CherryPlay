import { partyService, type ThemeAccessDto } from '@shared/services/partyService';
import { useAuthStore, useSettingsStore } from '@shared/stores';
import { getOnlineNetworkPolicy } from '@shared/streaming';

import { usePartyWorkspaceStore } from './partyWorkspaceStore';
import { resolveThemeAccessAfterFetchFailure } from './partyWorkspaceUtils';

let themeAccessLoadGeneration = 0;

export type ThemeAccessLoadResult = 'ok' | 'skipped' | 'failed' | 'unreachable';

function getPartyStore() {
  return usePartyWorkspaceStore.getState();
}

function isThemeAccessSessionActive(): boolean {
  const networkEnabled = getOnlineNetworkPolicy({
    enableStreaming: useSettingsStore.getState().enableStreaming,
  }).networkEnabled;
  return networkEnabled && useAuthStore.getState().isAuthenticated();
}

function clearThemeAccessState(): void {
  const store = getPartyStore();
  store.setThemeAccess(null);
  store.setThemeAccessErrorMessage(null);
  store.setIsThemeAccessLoading(false);
}

export function invalidatePartyThemeAccessLoads(): void {
  themeAccessLoadGeneration += 1;
  clearThemeAccessState();
}

export function shouldShowThemeAccessLoading(themeAccess: ThemeAccessDto | null): boolean {
  return themeAccess === null;
}

export async function loadPartyThemeAccess(forceRefresh = false): Promise<ThemeAccessLoadResult> {
  if (!isThemeAccessSessionActive()) {
    invalidatePartyThemeAccessLoads();
    return 'skipped';
  }

  const store = getPartyStore();
  const generation = themeAccessLoadGeneration;
  const showLoading = shouldShowThemeAccessLoading(store.themeAccess);
  if (showLoading) {
    store.setIsThemeAccessLoading(true);
  }

  try {
    const access = await partyService.getThemeAccess(forceRefresh);
    if (generation !== themeAccessLoadGeneration || !isThemeAccessSessionActive()) {
      if (generation === themeAccessLoadGeneration) {
        invalidatePartyThemeAccessLoads();
      }
      return 'skipped';
    }
    store.setThemeAccess(access);
    store.setThemeAccessErrorMessage(null);
    return 'ok';
  } catch (error) {
    console.warn('Failed to load theme access:', error);
    if (generation !== themeAccessLoadGeneration || !isThemeAccessSessionActive()) {
      if (generation === themeAccessLoadGeneration) {
        invalidatePartyThemeAccessLoads();
      }
      return 'skipped';
    }
    const resolution = resolveThemeAccessAfterFetchFailure(store.themeAccess);
    store.setThemeAccess(resolution.themeAccess);
    store.setThemeAccessErrorMessage(resolution.themeAccessErrorMessage);

    try {
      const reachable = await partyService.checkServerReachable();
      if (generation !== themeAccessLoadGeneration || !isThemeAccessSessionActive()) {
        return 'skipped';
      }
      if (!reachable) {
        store.setServerUnreachable(true);
        return 'unreachable';
      }
    } catch {
      if (generation !== themeAccessLoadGeneration || !isThemeAccessSessionActive()) {
        return 'skipped';
      }
      store.setServerUnreachable(true);
      return 'unreachable';
    }

    return 'failed';
  } finally {
    if (showLoading && generation === themeAccessLoadGeneration) {
      getPartyStore().setIsThemeAccessLoading(false);
    }
  }
}
