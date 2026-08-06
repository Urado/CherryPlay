import {
  AUTH_RATE_LIMITED,
  CHANGE_PASSWORD_OAUTH_ONLY,
  CHANGE_PASSWORD_WRONG_CURRENT,
  FORGOT_PASSWORD_SERVICE_UNAVAILABLE,
  RESET_PASSWORD_INVALID_TOKEN,
} from '../../core/utils/authValidation';
import { getAuthErrorMessage, getAuthHttpStatus } from '../../types/auth';

function isKnownOAuthOnlyMessage(message: string): boolean {
  return (
    message === CHANGE_PASSWORD_OAUTH_ONLY ||
    message.includes('только для аккаунта с email и паролем')
  );
}

export function resolveForgotPasswordError(error: unknown): string {
  const status = getAuthHttpStatus(error);
  if (status === 503) {
    return FORGOT_PASSWORD_SERVICE_UNAVAILABLE;
  }
  if (status === 429) {
    return AUTH_RATE_LIMITED;
  }
  return getAuthErrorMessage(error) || FORGOT_PASSWORD_SERVICE_UNAVAILABLE;
}

export function resolveResetPasswordError(error: unknown): string {
  const status = getAuthHttpStatus(error);
  if (status === 400) {
    const message = getAuthErrorMessage(error);
    if (message) {
      return message;
    }
    return RESET_PASSWORD_INVALID_TOKEN;
  }
  if (status === 429) {
    return AUTH_RATE_LIMITED;
  }
  return getAuthErrorMessage(error) || RESET_PASSWORD_INVALID_TOKEN;
}

export function resolveChangePasswordError(error: unknown): string {
  const status = getAuthHttpStatus(error);
  if (status === 401) {
    return CHANGE_PASSWORD_WRONG_CURRENT;
  }
  if (status === 400) {
    const message = getAuthErrorMessage(error);
    if (message) {
      if (isKnownOAuthOnlyMessage(message)) {
        return CHANGE_PASSWORD_OAUTH_ONLY;
      }
      return message;
    }
    return CHANGE_PASSWORD_OAUTH_ONLY;
  }
  if (status === 429) {
    return AUTH_RATE_LIMITED;
  }
  return getAuthErrorMessage(error) || CHANGE_PASSWORD_WRONG_CURRENT;
}
