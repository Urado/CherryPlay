import { useUIStore } from '../stores/uiStore';

import { clearAuthSession } from './authSession';

export const SESSION_EXPIRED_USER_MESSAGE = 'Сессия устарела. Войдите ещё раз.';

export function handleAuthError(error?: Error | string): void {
  const technicalMessage =
    typeof error === 'string'
      ? error
      : error instanceof Error
        ? error.message
        : SESSION_EXPIRED_USER_MESSAGE;

  clearAuthSession();

  const uiStore = useUIStore.getState();
  uiStore.closeModal();

  uiStore.addNotification({
    type: 'error',
    message: SESSION_EXPIRED_USER_MESSAGE,
    duration: 8000,
  });

  console.warn('[AuthErrorHandler] Authentication error:', technicalMessage);
}

export function isSessionExpiredError(error: unknown): boolean {
  if (typeof error === 'string') {
    return error.includes(SESSION_EXPIRED_USER_MESSAGE);
  }
  if (error instanceof Error) {
    return error.message.includes(SESSION_EXPIRED_USER_MESSAGE);
  }
  return false;
}

export function isAuthErrorMessage(error: unknown): boolean {
  if (isSessionExpiredError(error)) {
    return true;
  }
  if (error instanceof Error) {
    const message = error.message;
    return (
      message.includes('401') ||
      message.includes('Authentication') ||
      message.includes('Unauthorized') ||
      message.includes('token expired') ||
      message.includes('token invalid') ||
      message.includes('Session check failed')
    );
  }
  return false;
}

export { isAuthErrorMessage as isAuthError };
