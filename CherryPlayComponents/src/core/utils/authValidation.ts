export const MIN_PASSWORD_LENGTH = 6;
export const MAX_ORGANIZER_NAME_LENGTH = 200;

export const FORGOT_PASSWORD_GENERIC_SUCCESS =
  'Если аккаунт с таким email существует, мы отправили инструкции';

export const FORGOT_PASSWORD_SERVICE_UNAVAILABLE = 'Сервис временно недоступен. Попробуйте позже.';

export const RESET_PASSWORD_INVALID_TOKEN = 'Ссылка недействительна или устарела';

export const CHANGE_PASSWORD_WRONG_CURRENT = 'Неверный текущий пароль';

export const CHANGE_PASSWORD_OAUTH_ONLY =
  'Смена пароля доступна только для аккаунта с email и паролем';

export const AUTH_RATE_LIMITED = 'Слишком много запросов. Попробуйте позже.';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(email: string): boolean {
  return EMAIL_REGEX.test(email);
}

export function validateOrganizerName(name: string): boolean {
  const trimmed = name.trim();
  return trimmed.length > 0 && trimmed.length <= MAX_ORGANIZER_NAME_LENGTH;
}

export function validatePassword(password: string): boolean {
  return password.length >= MIN_PASSWORD_LENGTH;
}

export function validatePasswordMatch(password: string, confirmPassword: string): boolean {
  return password === confirmPassword;
}
