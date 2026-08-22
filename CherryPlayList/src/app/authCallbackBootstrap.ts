import {
  completeBrowserLoginFlow,
  failBrowserLoginFlow,
  getBrowserLoginFlowState,
} from '@shared/auth/browserLoginFlow';
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

export function resetAuthCallbackBootstrapForTests(): void {
  bootstrapStarted = false;
}

export function initializeAuthCallbackBootstrap(): void {
  if (bootstrapStarted) {
    return;
  }
  if (isDemoAuthMode()) {
    return;
  }
  if (getAppMode() !== 'electron') {
    return;
  }
  if (!isPlatformInitialized() || !getPlatformCapabilities().supportsRealAuth) {
    return;
  }
  bootstrapStarted = true;
  void runAuthCallbackLoop();
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
