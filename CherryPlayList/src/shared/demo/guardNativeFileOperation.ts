import { getPlatformCapabilities } from '../platform/platformCapabilities';

import { notifyDemoUnavailable } from './notifyDemoUnavailable';

export const isNativeFileOperationBlocked = (): boolean => {
  return !getPlatformCapabilities().supportsNativeFileSystem;
};

export const guardNativeFileOperation = (): boolean => {
  if (isNativeFileOperationBlocked()) {
    notifyDemoUnavailable();
    return false;
  }
  return true;
};
