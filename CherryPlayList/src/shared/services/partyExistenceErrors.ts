import { isAuthError } from '../utils/authErrorHandler';

/** Auth / invalid-id failures that must not trigger party reconnect loops. */
export function isDefinitivePartyExistenceError(error: unknown): boolean {
  if (isAuthError(error)) {
    return true;
  }
  if (!(error instanceof Error)) {
    return false;
  }
  const message = error.message;
  return (
    message.includes('необходимо войти') ||
    message.includes('Некорректный идентификатор вечеринки')
  );
}
