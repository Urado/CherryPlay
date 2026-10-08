import { ipcMain, shell, BrowserWindow } from 'electron';

export type AuthCallbackData = {
  code: string;
  provider?: string;
};

const AUTH_CALLBACK_TIMEOUT_MS = 3 * 60 * 1000;
export const AUTH_CALLBACK_CANCELLED_MESSAGE = 'OAuth callback cancelled';

let authCallbackPromise: {
  resolve: (value: { success: true; data: AuthCallbackData }) => void;
  reject: (error: Error) => void;
} | null = null;

let authCallbackTimeoutId: ReturnType<typeof setTimeout> | null = null;
let pendingCallbackUrl: string | null = null;

function clearAuthCallbackTimeout(): void {
  if (authCallbackTimeoutId !== null) {
    clearTimeout(authCallbackTimeoutId);
    authCallbackTimeoutId = null;
  }
}

function rejectAuthCallback(error: Error): void {
  clearAuthCallbackTimeout();
  if (!authCallbackPromise) {
    return;
  }
  authCallbackPromise.reject(error);
  authCallbackPromise = null;
}

function cancelAuthCallbackWait(): boolean {
  if (!authCallbackPromise) {
    return false;
  }
  rejectAuthCallback(new Error(AUTH_CALLBACK_CANCELLED_MESSAGE));
  return true;
}

function parseAuthCallbackData(url: string): AuthCallbackData {
  const urlObj = new URL(url);
  const code = urlObj.searchParams.get('code');
  const state = urlObj.searchParams.get('state');
  const providerParam = urlObj.searchParams.get('provider');
  const pathProvider = urlObj.pathname.split('/').filter(Boolean)[1];
  const provider = state || providerParam || pathProvider || undefined;

  if (!code) {
    throw new Error('Invalid OAuth callback URL');
  }

  const data: AuthCallbackData = { code };
  if (provider) {
    data.provider = provider;
  }
  return data;
}

function resolveAuthCallback(data: AuthCallbackData, mainWindow: BrowserWindow | null): boolean {
  if (!authCallbackPromise) {
    return false;
  }

  clearAuthCallbackTimeout();
  authCallbackPromise.resolve({
    success: true,
    data,
  });
  authCallbackPromise = null;
  focusMainWindow(mainWindow);
  return true;
}

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

  ipcMain.handle('auth:registerCallback', async (event) => {
    return new Promise<{ success: true; data: AuthCallbackData }>((resolve, reject) => {
      cancelAuthCallbackWait();
      authCallbackPromise = { resolve, reject };

      if (pendingCallbackUrl) {
        const url = pendingCallbackUrl;
        pendingCallbackUrl = null;
        try {
          const data = parseAuthCallbackData(url);
          const mainWindow = BrowserWindow.fromWebContents(event.sender);
          if (resolveAuthCallback(data, mainWindow)) {
            return;
          }
        } catch (error) {
          rejectAuthCallback(
            error instanceof Error ? error : new Error('Failed to parse OAuth callback'),
          );
          return;
        }
      }

      authCallbackTimeoutId = setTimeout(() => {
        rejectAuthCallback(new Error('OAuth callback timeout'));
      }, AUTH_CALLBACK_TIMEOUT_MS);
    });
  });

  ipcMain.handle('auth:cancelCallback', async () => {
    cancelAuthCallbackWait();
    return { success: true };
  });

  ipcMain.handle('auth:deliverCallbackUrl', async (_event, { url }: { url: string }) => {
    try {
      handleOAuthCallback(url, null);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to deliver auth callback',
      };
    }
  });
}

function focusMainWindow(mainWindow: BrowserWindow | null): void {
  if (!mainWindow) {
    return;
  }
  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  mainWindow.focus();
}

export function handleOAuthCallback(url: string, mainWindow: BrowserWindow | null): void {
  try {
    const data = parseAuthCallbackData(url);
    if (!resolveAuthCallback(data, mainWindow)) {
      pendingCallbackUrl = url;
    }
  } catch (error) {
    console.error('Error parsing OAuth callback URL:', error);
    rejectAuthCallback(
      error instanceof Error ? error : new Error('Failed to parse OAuth callback'),
    );
  }
}

export function resetAuthIpcStateForTests(): void {
  clearAuthCallbackTimeout();
  authCallbackPromise = null;
  pendingCallbackUrl = null;
}
