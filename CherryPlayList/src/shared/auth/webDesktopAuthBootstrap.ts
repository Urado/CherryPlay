import { authService } from '../services/authService';
import { useAuthStore } from '../stores/authStore';
import { setAuthSessionToken } from '../utils/authSession';

import {
  clearPendingDesktopAuthCode,
  DESKTOP_AUTH_BROADCAST_CHANNEL,
  DESKTOP_AUTH_SESSION_READY_TYPE,
} from './desktopAuthBroadcast';

export const DESKTOP_AUTH_CODE_QUERY = 'desktop_auth_code';
export const DESKTOP_AUTH_ERROR_SESSION_KEY = 'cherryplaylist-desktop-auth-error';

const waitForAuthStoreHydration = async (): Promise<void> => {
  const persistApi = useAuthStore.persist;
  if (persistApi.hasHydrated()) {
    return;
  }
  await new Promise<void>((resolve) => {
    const unsub = persistApi.onFinishHydration(() => {
      unsub();
      resolve();
    });
  });
}

const takeDesktopAuthCodeFromUrl = (): string | null => {
  if (typeof window === 'undefined') {
    return null;
  }
  const url = new URL(window.location.href);
  const code = url.searchParams.get(DESKTOP_AUTH_CODE_QUERY);
  if (!code || !code.trim()) {
    return null;
  }
  url.searchParams.delete(DESKTOP_AUTH_CODE_QUERY);
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  clearPendingDesktopAuthCode();
  return code.trim();
}

export const readDesktopAuthBootstrapError = (): string | null => {
  try {
    const message = sessionStorage.getItem(DESKTOP_AUTH_ERROR_SESSION_KEY);
    return message && message.trim() ? message : null;
  } catch {
    return null;
  }
}

export const clearDesktopAuthBootstrapError = (): void => {
  try {
    sessionStorage.removeItem(DESKTOP_AUTH_ERROR_SESSION_KEY);
  } catch {
    return;
  }
}

const writeDesktopAuthBootstrapError = (message: string): void => {
  try {
    sessionStorage.setItem(DESKTOP_AUTH_ERROR_SESSION_KEY, message);
  } catch {
    return;
  }
}

export const consumeWebDesktopAuthCodeAtBootstrap = async (): Promise<void> => {
  const code = takeDesktopAuthCodeFromUrl();
  if (!code) {
    return;
  }

  await waitForAuthStoreHydration();

  try {
    const token = await authService.exchangeDesktopCode(code);
    setAuthSessionToken(token);

    const organizer = await authService.getCurrentOrganizer();
    useAuthStore.getState().setOrganizer({ id: organizer.id, name: organizer.name });
    clearDesktopAuthBootstrapError();
    try {
      const channel = new BroadcastChannel(DESKTOP_AUTH_BROADCAST_CHANNEL);
      channel.postMessage({ type: DESKTOP_AUTH_SESSION_READY_TYPE });
      channel.close();
    } catch {
      return;
    }
  } catch (error) {
    const message =
      error instanceof Error && error.message.trim()
        ? error.message
        : 'Не удалось войти. Код мог истечь или уже был использован.';
    writeDesktopAuthBootstrapError(message);
  }
}
