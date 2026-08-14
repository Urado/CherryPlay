import { partyService, type ThemeAccessDto } from '@shared/services/partyService';
import { useAuthStore, useSettingsStore } from '@shared/stores';
import { getOnlineNetworkPolicy } from '@shared/streaming';

import { usePartyWorkspaceStore } from './partyWorkspaceStore';
import { resolveThemeAccessAfterFetchFailure } from './partyWorkspaceUtils';

let themeAccessLoadGeneration = 0;

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

export async function loadPartyThemeAccess(forceRefresh = false): Promise<void> {
  if (!isThemeAccessSessionActive()) {
    invalidatePartyThemeAccessLoads();
    return;
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
      return;
    }
    store.setThemeAccess(access);
    store.setThemeAccessErrorMessage(null);
  } catch (error) {
    console.warn('Failed to load theme access:', error);
    if (generation !== themeAccessLoadGeneration || !isThemeAccessSessionActive()) {
      if (generation === themeAccessLoadGeneration) {
        invalidatePartyThemeAccessLoads();
      }
      return;
    }
    const resolution = resolveThemeAccessAfterFetchFailure(store.themeAccess);
    store.setThemeAccess(resolution.themeAccess);
    store.setThemeAccessErrorMessage(resolution.themeAccessErrorMessage);
  } finally {
    if (showLoading && generation === themeAccessLoadGeneration) {
      getPartyStore().setIsThemeAccessLoading(false);
    }
  }
}
