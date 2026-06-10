import {
  refreshPlatformCapabilities,
  resetPlatformCapabilitiesForTests,
} from './platformCapabilities';
import type { AppMode, PlatformAPI } from './types';

let platformInstance: PlatformAPI | null = null;
let currentAppMode: AppMode | null = null;

export function setPlatform(api: PlatformAPI, mode: AppMode): void {
  platformInstance = api;
  currentAppMode = mode;
  refreshPlatformCapabilities(mode);
}

export function getPlatform(): PlatformAPI {
  if (!platformInstance) {
    throw new Error(
      'Platform is not initialized. Call setPlatform() in bootstrap before rendering the app.',
    );
  }
  return platformInstance;
}

export function getPlatformAppMode(): AppMode | null {
  return currentAppMode;
}

export function isPlatformInitialized(): boolean {
  return platformInstance !== null;
}

/** Resets platform singleton — for unit tests only. */
export function resetPlatformForTests(): void {
  platformInstance = null;
  currentAppMode = null;
  resetPlatformCapabilitiesForTests();
}
