/**
 * Централизованный обработчик ошибок аутентификации
 */
import { useAuthStore } from '../stores/authStore';
import { useUIStore } from '../stores/uiStore';

/**
 * Обрабатывает ошибку аутентификации (401)
 * Очищает токен и показывает уведомление пользователю
 */
export function handleAuthError(error?: Error | string): void {
  const errorMessage =
    typeof error === 'string'
      ? error
      : error instanceof Error
        ? error.message
        : 'Authentication token expired or invalid. Please login again.';

  // Очищаем токен
  useAuthStore.getState().clearAuth();

  // Показываем уведомление пользователю
  useUIStore.getState().addNotification({
    type: 'error',
    message: errorMessage,
    duration: 8000,
  });

  console.warn('[AuthErrorHandler] Authentication error:', errorMessage);
}

/**
 * Проверяет, является ли ошибка ошибкой аутентификации
 */
export function isAuthError(error: unknown): boolean {
  if (error instanceof Error) {
    return (
      error.message.includes('401') ||
      error.message.includes('Authentication') ||
      error.message.includes('Unauthorized') ||
      error.message.includes('token expired') ||
      error.message.includes('token invalid')
    );
  }
  return false;
}
