import {
  completeBrowserLoginFlow,
  failBrowserLoginFlow,
  getBrowserLoginFlowState,
} from '@shared/auth/browserLoginFlow';
import {
  clearPendingDesktopAuthCode,
  DESKTOP_AUTH_BROADCAST_CHANNEL,
  DESKTOP_AUTH_PENDING_CODE_KEY,
  DESKTOP_AUTH_SESSION_READY_TYPE,
  isDesktopAuthCodeMessage,
  readPendingDesktopAuthCode,
} from '@shared/auth/desktopAuthBroadcast';
import {
  clearDesktopAuthBootstrapError,
  readDesktopAuthBootstrapError,
} from '@shared/auth/webDesktopAuthBootstrap';
import { isDemoAuthMode } from '@shared/demo/guardDemoAuth';
import {
  getAppMode,
  getPlatform,
  getPlatformCapabilities,
  isPlatformInitialized,
} from '@shared/platform';
import { authService } from '@shared/services/authService';
import { useAuthStore, useUIStore } from '@shared/stores';
import { setAuthSessionToken } from '@shared/utils/authSession';

type AuthCallbackResult =
  | { success: true; data: { code: string; provider?: string } }
  | { success: false; error: string };

const AUTH_CALLBACK_EXPIRED_MESSAGE =
  'Время ожидания истекло. Код входа действителен около 3 минут — попробуйте снова.';

let bootstrapStarted = false;
let webDemoAuthChannel: BroadcastChannel | null = null;
let webDemoStorageListener: ((event: StorageEvent) => void) | null = null;
let webDemoMessageListener: ((event: MessageEvent) => void) | null = null;
const handledDesktopAuthCodes = new Set<string>();

export function resetAuthCallbackBootstrapForTests(): void {
  bootstrapStarted = false;
  handledDesktopAuthCodes.clear();
  if (webDemoAuthChannel) {
    webDemoAuthChannel.close();
    webDemoAuthChannel = null;
  }
  if (typeof window !== 'undefined') {
    if (webDemoStorageListener) {
      window.removeEventListener('storage', webDemoStorageListener);
      webDemoStorageListener = null;
    }
    if (webDemoMessageListener) {
      window.removeEventListener('message', webDemoMessageListener);
      webDemoMessageListener = null;
    }
  }
}

export function initializeAuthCallbackBootstrap(): void {
  if (bootstrapStarted) {
    return;
  }
  if (isDemoAuthMode()) {
    return;
  }
  if (!isPlatformInitialized() || !getPlatformCapabilities().supportsRealAuth) {
    return;
  }

  const mode = getAppMode();
  if (mode === 'electron') {
    bootstrapStarted = true;
    void runAuthCallbackLoop();
    return;
  }

  if (mode === 'demo') {
    bootstrapStarted = true;
    startWebDemoAuthCallbackListener();
    notifyDesktopAuthBootstrapError();
  }
}

function notifyDesktopAuthBootstrapError(): void {
  const message = readDesktopAuthBootstrapError();
  if (!message) {
    return;
  }
  clearDesktopAuthBootstrapError();
  failBrowserLoginFlow(message);
  notifyAuthError(message, 8000);
}

function startWebDemoAuthCallbackListener(): void {
  consumePendingDesktopAuthCode();

  if (typeof window !== 'undefined') {
    webDemoStorageListener = (event: StorageEvent) => {
      if (event.key !== DESKTOP_AUTH_PENDING_CODE_KEY || !event.newValue) {
        return;
      }
      consumePendingDesktopAuthCode();
    };
    window.addEventListener('storage', webDemoStorageListener);

    webDemoMessageListener = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) {
        return;
      }
      if (!isDesktopAuthCodeMessage(event.data)) {
        return;
      }
      clearPendingDesktopAuthCode();
      void completeDesktopAuth(event.data.code.trim());
    };
    window.addEventListener('message', webDemoMessageListener);
  }

  if (typeof BroadcastChannel === 'undefined') {
    return;
  }

  webDemoAuthChannel = new BroadcastChannel(DESKTOP_AUTH_BROADCAST_CHANNEL);
  webDemoAuthChannel.onmessage = (event: MessageEvent) => {
    const data = event.data;
    if (
      data &&
      typeof data === 'object' &&
      (data as { type?: unknown }).type === DESKTOP_AUTH_SESSION_READY_TYPE
    ) {
      void useAuthStore.persist.rehydrate().then(() => {
        if (useAuthStore.getState().isAuthenticated()) {
          completeBrowserLoginFlow();
          useUIStore.getState().addNotification({
            type: 'success',
            message: 'Вход выполнен',
            duration: 4000,
          });
        } else {
          completeBrowserLoginFlow();
        }
      });
      return;
    }
    if (!isDesktopAuthCodeMessage(data)) {
      return;
    }
    clearPendingDesktopAuthCode();
    void completeDesktopAuth(data.code.trim());
  };
}

function consumePendingDesktopAuthCode(): void {
  const code = readPendingDesktopAuthCode();
  if (!code) {
    return;
  }
  clearPendingDesktopAuthCode();
  void completeDesktopAuth(code);
}

function notifyAuthError(message: string, duration = 5000): void {
  useUIStore.getState().addNotification({
    type: 'error',
    message,
    duration,
  });
}

function failWaitingBrowserLogin(message: string): boolean {
  if (getBrowserLoginFlowState().status !== 'waiting') {
    return false;
  }
  failBrowserLoginFlow(message);
  return true;
}

async function runAuthCallbackLoop(): Promise<void> {
  while (bootstrapStarted) {
    try {
      const result = (await getPlatform().invoke('auth:registerCallback')) as AuthCallbackResult;
      if (result.success && result.data?.code) {
        await completeDesktopAuth(result.data.code);
        continue;
      }

      const message =
        !result.success && result.error.trim()
          ? result.error
          : 'Не удалось обработать вход из браузера';
      if (failWaitingBrowserLogin(message)) {
        notifyAuthError(message);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '';
      if (errorMessage.includes('cancelled')) {
        continue;
      }

      const isTimeout = errorMessage.includes('timeout');
      if (isTimeout) {
        if (failWaitingBrowserLogin(AUTH_CALLBACK_EXPIRED_MESSAGE)) {
          notifyAuthError(AUTH_CALLBACK_EXPIRED_MESSAGE, 8000);
        }
        continue;
      }

      const message = errorMessage.trim() ? errorMessage : 'Не удалось обработать вход из браузера';
      console.error('[AuthCallbackBootstrap] Callback error:', error);
      if (failWaitingBrowserLogin(message)) {
        notifyAuthError(message);
      }
    }
  }
}

async function completeDesktopAuth(code: string): Promise<void> {
  if (handledDesktopAuthCodes.has(code)) {
    return;
  }
  handledDesktopAuthCodes.add(code);

  try {
    const token = await authService.exchangeDesktopCode(code);
    setAuthSessionToken(token);

    const organizer = await authService.getCurrentOrganizer();
    useAuthStore.getState().setOrganizer({ id: organizer.id, name: organizer.name });
    completeBrowserLoginFlow();

    useUIStore.getState().addNotification({
      type: 'success',
      message: 'Вход выполнен',
      duration: 4000,
    });
  } catch (error) {
    const message =
      error instanceof Error && error.message.trim()
        ? error.message
        : 'Не удалось войти. Код мог истечь или уже был использован.';
    failBrowserLoginFlow(message);
    notifyAuthError(message, 8000);
  }
}
