import { ipcMain, shell, BrowserWindow } from 'electron';

let oAuthCallbackPromise: {
  resolve: (value: { success: true; data: { code: string; provider: string } }) => void;
  reject: (error: Error) => void;
} | null = null;

export function registerAuthHandlers(_mainWindow: BrowserWindow | null): void {
  ipcMain.handle('auth:openExternal', async (_event, { url }: { url: string }) => {
    try {
      await shell.openExternal(url);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to open external URL',
      };
    }
  });

  ipcMain.handle('auth:registerCallback', async (_event) => {
    return new Promise<{ success: true; data: { code: string; provider: string } }>(
      (resolve, reject) => {
        oAuthCallbackPromise = { resolve, reject };
        setTimeout(
          () => {
            if (oAuthCallbackPromise) {
              oAuthCallbackPromise.reject(new Error('OAuth callback timeout'));
              oAuthCallbackPromise = null;
            }
          },
          5 * 60 * 1000,
        );
      },
    );
  });
}

export function handleOAuthCallback(url: string, mainWindow: BrowserWindow | null): void {
  try {
    const urlObj = new URL(url);
    const code = urlObj.searchParams.get('code');
    const state = urlObj.searchParams.get('state');
    const provider = state || urlObj.pathname.split('/').filter(Boolean)[1] || '';

    if (code && provider && oAuthCallbackPromise) {
      oAuthCallbackPromise.resolve({
        success: true,
        data: { code, provider },
      });
      oAuthCallbackPromise = null;

      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
      }
    } else if (!code || !provider) {
      console.error('Invalid OAuth callback URL:', url);
      if (oAuthCallbackPromise) {
        oAuthCallbackPromise.reject(new Error('Invalid OAuth callback URL'));
        oAuthCallbackPromise = null;
      }
    }
  } catch (error) {
    console.error('Error parsing OAuth callback URL:', error);
    if (oAuthCallbackPromise) {
      oAuthCallbackPromise.reject(
        error instanceof Error ? error : new Error('Failed to parse OAuth callback'),
      );
      oAuthCallbackPromise = null;
    }
  }
}
