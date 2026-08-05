import type { AppMode } from './types';

export function isDemoLiveMode(): boolean {
  return process.env.VITE_DEMO_LIVE === '1';
}

export function isDemoFixturesMode(appMode?: AppMode): boolean {
  if (isDemoLiveMode()) {
    return false;
  }
  if (appMode !== undefined) {
    return appMode === 'demo';
  }
  return process.env.VITE_APP_MODE === 'demo';
}
