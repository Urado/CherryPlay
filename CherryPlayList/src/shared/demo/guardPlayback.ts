import { getPlatformCapabilities } from '../platform/platformCapabilities';

import { notifyDemoUnavailable } from './notifyDemoUnavailable';

/** True when local file playback must not run (web demo, capacitor stub, etc.). */
export function isLocalFilePlaybackBlocked(): boolean {
  return !getPlatformCapabilities().supportsLocalFilePlayback;
}

/**
 * Blocks playback when local file playback is unsupported.
 * @returns true if the caller may proceed with playback.
 */
export function guardPlaybackUnavailable(): boolean {
  if (isLocalFilePlaybackBlocked()) {
    notifyDemoUnavailable();
    return false;
  }
  return true;
}
