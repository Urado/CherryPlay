/**
 * Authentication validation utilities
 * Shared between CherryPlayWeb and CherryPlayList
 */

export const MIN_PASSWORD_LENGTH = 6;
export const MAX_ORGANIZER_NAME_LENGTH = 200;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validates email format
 */
export function validateEmail(email: string): boolean {
  return EMAIL_REGEX.test(email);
}

/**
 * Validates organizer name
 */
export function validateOrganizerName(name: string): boolean {
  const trimmed = name.trim();
  return trimmed.length > 0 && trimmed.length <= MAX_ORGANIZER_NAME_LENGTH;
}

/**
 * Validates password length
 */
export function validatePassword(password: string): boolean {
  return password.length >= MIN_PASSWORD_LENGTH;
}
