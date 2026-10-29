import { getPlatformCapabilities } from '../platform/platformCapabilities';

import { notifyDemoUnavailable } from './notifyDemoUnavailable';

export const isLocalFilePlaybackBlocked = (): boolean => {
  return !getPlatformCapabilities().supportsLocalFilePlayback;
};

export const guardPlaybackUnavailable = (): boolean => {
  if (isLocalFilePlaybackBlocked()) {
    notifyDemoUnavailable();
    return false;
  }
  return true;
};
