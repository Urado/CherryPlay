export { getAppMode, isNativePlatformAvailable } from './appMode';
export {
  DEMO_UNAVAILABLE_MESSAGE,
  demoUnavailableResponse,
  throwDemoUnavailable,
} from './demoUnavailable';
export { ElectronPlatform } from './electronPlatform';
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
