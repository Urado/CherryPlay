import { ipcMain, shell } from 'electron';

import { getConfiguredWebBaseUrl } from './config.js';

const DOCUMENT_PATHS = {
  privacy: '/privacy',
  legal: '/legal',
} as const;

export function registerLegalHandlers(): void {
  ipcMain.handle('legal:openDocument', async (_event, payload: { document: unknown }) => {
    try {
      if (payload?.document !== 'privacy' && payload?.document !== 'legal') {
        throw new Error('Invalid legal document');
      }

      const webBaseUrl = new URL(getConfiguredWebBaseUrl());
      if (!['http:', 'https:'].includes(webBaseUrl.protocol) || webBaseUrl.username || webBaseUrl.password) {
        throw new Error('Invalid configured web base URL');
      }

      webBaseUrl.pathname = DOCUMENT_PATHS[payload.document];
      webBaseUrl.search = '';
      webBaseUrl.hash = '';
      await shell.openExternal(webBaseUrl.toString());
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to open legal page' };
    }
  });
}
