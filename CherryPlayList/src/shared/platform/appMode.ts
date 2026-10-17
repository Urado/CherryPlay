import { getPlatformCapabilities } from './platformCapabilities';
import { getPlatformAppMode, isPlatformInitialized } from './platformContext';
import type { AppMode } from './types';

export const getAppMode = (): AppMode => {
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
};

export const isNativePlatformAvailable = (): boolean => {
  if (isPlatformInitialized()) {
    return getPlatformCapabilities().supportsAimpWorkspace;
  }

  return (
    import.meta.env.VITE_APP_MODE !== 'demo' &&
    import.meta.env.VITE_APP_MODE !== 'capacitor' &&
    typeof window !== 'undefined' &&
    typeof window.api !== 'undefined'
  );
};
