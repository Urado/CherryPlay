import { ipcMain, app } from 'electron';

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
}
