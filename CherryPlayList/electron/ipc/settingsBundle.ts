import fs from 'fs/promises';

import { ipcMain } from 'electron';

import { validatePath } from '../utils/fsHelpers.js';

const saveSettingsBundle = async (path: string, bundle: unknown): Promise<void> => {
  await fs.writeFile(path, JSON.stringify(bundle, null, 2), 'utf-8');
};

const loadSettingsBundle = async (path: string): Promise<unknown> => {
  const content = await fs.readFile(path, 'utf-8');
  return JSON.parse(content) as unknown;
};

export const registerSettingsBundleHandlers = (): void => {
  ipcMain.handle(
    'settings:saveBundle',
    async (_event, payload: { path: string; bundle: unknown }) => {
      try {
        if (!validatePath(payload.path)) {
          return {
            success: false,
            error: 'Invalid path: path traversal detected',
          };
        }

        await saveSettingsBundle(payload.path, payload.bundle);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: (error as Error).message,
        };
      }
    },
  );

  ipcMain.handle('settings:loadBundle', async (_event, payload: { path: string }) => {
    try {
      if (!validatePath(payload.path)) {
        return {
          success: false,
          error: 'Invalid path: path traversal detected',
        };
      }

      const data = await loadSettingsBundle(payload.path);
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  });
};
