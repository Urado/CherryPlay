import { getPlatformCapabilities } from './platformCapabilities';
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

  if (import.meta.env.VITE_APP_MODE === 'capacitor') {
    return 'capacitor';
  }

  if (typeof window !== 'undefined' && typeof window.api !== 'undefined') {
    return 'electron';
  }

  return 'electron';
}

/**
 * @deprecated Prefer {@link getPlatformCapabilities}.supportsAimpWorkspace for feature gating.
 * True when the AIMP desktop workspace bridge is available (Electron only).
 */
export function isNativePlatformAvailable(): boolean {
  if (isPlatformInitialized()) {
    return getPlatformCapabilities().supportsAimpWorkspace;
  }

  return (
    import.meta.env.VITE_APP_MODE !== 'demo' &&
    import.meta.env.VITE_APP_MODE !== 'capacitor' &&
    typeof window !== 'undefined' &&
    typeof window.api !== 'undefined'
  );
}
