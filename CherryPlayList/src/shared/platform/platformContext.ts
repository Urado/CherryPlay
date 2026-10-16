import {
  refreshPlatformCapabilities,
  resetPlatformCapabilitiesForTests,
} from './platformCapabilities';
import type { AppMode, PlatformAPI } from './types';

let platformInstance: PlatformAPI | null = null;
let currentAppMode: AppMode | null = null;

export const setPlatform = (api: PlatformAPI, mode: AppMode): void => {
  platformInstance = api;
  currentAppMode = mode;
  refreshPlatformCapabilities(mode);
}

export const getPlatform = (): PlatformAPI => {
  if (!platformInstance) {
    throw new Error(
      'Platform is not initialized. Call setPlatform() in bootstrap before rendering the app.',
    );
  }
  return platformInstance;
}

export const getPlatformAppMode = (): AppMode | null => {
  return currentAppMode;
}

export const isPlatformInitialized = (): boolean => {
  return platformInstance !== null;
}

export const resetPlatformForTests = (): void => {
  platformInstance = null;
  currentAppMode = null;
  resetPlatformCapabilitiesForTests();
}
