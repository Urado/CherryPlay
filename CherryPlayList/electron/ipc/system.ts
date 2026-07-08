import { ipcMain, app, shell, BrowserWindow } from 'electron';

import {
  APP_MIN_WINDOW_WIDTH,
  APP_MIN_WINDOW_HEIGHT,
} from '../../src/shared/contracts/windowMins.js';
import { validatePath } from '../utils/fsHelpers.js';

/**
 * Re-exported app-level window-min floor (single source: shared contracts).
 * Applied when the layout is empty or renderer-computed mins fall below it,
 * so the app always keeps a usable minimum footprint.
 */
export { APP_MIN_WINDOW_WIDTH, APP_MIN_WINDOW_HEIGHT };

/**
 * Normalize a renderer-provided minimum dimension to a safe integer floored at
 * the given app-level minimum. Non-finite / negative values collapse to the floor.
 */
function normalizeMinDimension(value: unknown, floor: number): number {
  const numeric = typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : 0;
  return Math.max(floor, numeric);
}

/**
 * Get system path (documents, music, downloads, etc.)
 */
function getSystemPath(name: string): string {
  try {
    // Valid path names (using Electron's app.getPath valid names)
    const validPaths = [
      'home',
      'appData',
      'userData',
      'temp',
      'exe',
      'module',
      'desktop',
      'documents',
      'downloads',
      'music',
      'pictures',
      'videos',
      'logs',
      'sessionData',
      'recent',
      'crashDumps',
    ] as const;

    if (!(validPaths as readonly string[]).includes(name)) {
      throw new Error(`Invalid system path name: ${name}`);
    }

    return app.getPath(name as Parameters<typeof app.getPath>[0]);
  } catch (error) {
    throw new Error(`Failed to get system path: ${(error as Error).message}`);
  }
}

/**
 * Register system IPC handlers
 */
export function registerSystemHandlers(): void {
  ipcMain.handle('system:getPath', async (event, payload: { name: string }) => {
    try {
      const path = getSystemPath(payload.name);
      return {
        success: true,
        data: path,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  });

  ipcMain.handle('system:openExternal', async (event, payload: { url: string }) => {
    try {
      await shell.openExternal(payload.url);
      return {
        success: true,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  });

  ipcMain.handle(
    'system:setMinimumWindowSize',
    async (event, payload: { minWidth: number; minHeight: number }) => {
      try {
        const window = BrowserWindow.fromWebContents(event.sender);
        if (!window) {
          return {
            success: false,
            error: 'No window associated with setMinimumWindowSize request',
          };
        }

        const minWidth = normalizeMinDimension(payload?.minWidth, APP_MIN_WINDOW_WIDTH);
        const minHeight = normalizeMinDimension(payload?.minHeight, APP_MIN_WINDOW_HEIGHT);

        window.setMinimumSize(minWidth, minHeight);

        return {
          success: true,
          data: { minWidth, minHeight },
        };
      } catch (error) {
        return {
          success: false,
          error: (error as Error).message,
        };
      }
    },
  );

  ipcMain.handle('system:openPath', async (event, payload: { path: string }) => {
    try {
      if (!validatePath(payload.path)) {
        return {
          success: false,
          error: 'Invalid path: path traversal detected',
        };
      }
      const openErr = await shell.openPath(payload.path);
      if (openErr) {
        return {
          success: false,
          error: openErr,
        };
      }
      return {
        success: true,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  });
}
