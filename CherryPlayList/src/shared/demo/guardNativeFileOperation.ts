import { getPlatformCapabilities } from '../platform/platformCapabilities';

import { notifyDemoUnavailable } from './notifyDemoUnavailable';

/** True when native FS / save dialogs must not run (browser web demo, capacitor stub, etc.). */
export function isNativeFileOperationBlocked(): boolean {
  return !getPlatformCapabilities().supportsNativeFileSystem;
}

/**
 * Blocks the operation in demo with a standard toast.
 * @returns true if the caller may proceed with Electron/native FS work.
 */
export function guardNativeFileOperation(): boolean {
  if (isNativeFileOperationBlocked()) {
    notifyDemoUnavailable();
    return false;
  }
  return true;
}
