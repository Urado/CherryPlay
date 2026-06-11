import { getPlatformCapabilities } from '../platform/platformCapabilities';

export function isDemoAuthMode(): boolean {
  return !getPlatformCapabilities().supportsRealAuth;
}
