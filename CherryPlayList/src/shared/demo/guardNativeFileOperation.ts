import { getAppMode } from '../platform/appMode';

import { notifyDemoUnavailable } from './notifyDemoUnavailable';

/** True when native FS / save dialogs must not run (browser web demo). */
export function isNativeFileOperationBlocked(): boolean {
  return getAppMode() === 'demo';
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
