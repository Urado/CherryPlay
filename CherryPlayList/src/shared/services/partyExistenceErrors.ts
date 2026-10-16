import { isAuthError } from '../utils/authErrorHandler';

export const isDefinitivePartyExistenceError = (error: unknown): boolean => {
  if (isAuthError(error)) {
    return true;
  }
  if (!(error instanceof Error)) {
    return false;
  }
  const message = error.message;
  return (
    message.includes('необходимо войти') || message.includes('Некорректный идентификатор вечеринки')
  );
};
