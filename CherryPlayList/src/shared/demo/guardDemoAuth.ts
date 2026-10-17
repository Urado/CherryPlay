import { getPlatformCapabilities } from '../platform/platformCapabilities';

export const isDemoAuthMode = (): boolean => {
  return !getPlatformCapabilities().supportsRealAuth;
};
