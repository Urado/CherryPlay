import { getPlatformAppMode, isPlatformInitialized } from './platformContext';
import type { AppMode } from './types';

export function getAppMode(): AppMode {
  const fromPlatform = getPlatformAppMode();
  if (fromPlatform) {
    return fromPlatform;
  }

  if (import.meta.env.VITE_APP_MODE === 'demo') {
    return 'demo';
  }

  if (typeof window !== 'undefined' && typeof window.api !== 'undefined') {
    return 'electron';
  }

  return 'electron';
}

/** True when running in Electron with the real preload bridge (not web demo). */
export function isNativePlatformAvailable(): boolean {
  if (isPlatformInitialized()) {
    return getAppMode() === 'electron';
  }

  return (
    import.meta.env.VITE_APP_MODE !== 'demo' &&
    typeof window !== 'undefined' &&
    typeof window.api !== 'undefined'
  );
}
