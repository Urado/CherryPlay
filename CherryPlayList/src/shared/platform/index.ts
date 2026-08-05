export { getAppMode, isNativePlatformAvailable } from './appMode';
export { CapacitorPlatform } from './capacitorPlatform';
export { isDemoFixturesMode, isDemoLiveMode } from './demoLiveMode';
export {
  DEMO_UNAVAILABLE_MESSAGE,
  PLATFORM_UNAVAILABLE_MESSAGE,
  demoUnavailableResponse,
  getPlatformUnavailableMessage,
  platformUnavailableResponse,
  throwDemoUnavailable,
  throwPlatformUnavailable,
} from './demoUnavailable';
export { ElectronPlatform } from './electronPlatform';
export {
  derivePlatformCapabilities,
  getPlatformCapabilities,
  refreshPlatformCapabilities,
} from './platformCapabilities';
export type { PlatformCapabilities } from './platformCapabilities';
export { WebDemoPlatform } from './webDemoPlatform';
export {
  getPlatform,
  getPlatformAppMode,
  isPlatformInitialized,
  setPlatform,
} from './platformContext';
export type {
  AppMode,
  DirectoryItem,
  InvokeChannel,
  IPCResponse,
  OnChannel,
  PlatformAPI,
  PlatformAimpApi,
} from './types';
export { usePlatformCapabilities } from '../hooks/usePlatformCapabilities';
