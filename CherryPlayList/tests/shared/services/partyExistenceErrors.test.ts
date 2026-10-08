jest.mock('../../../src/shared/utils/authErrorHandler', () => ({
  isAuthError: (error: unknown) =>
    error instanceof Error &&
    (error.message.includes('Сессия устарела') ||
      error.message.includes('401') ||
      error.message.includes('Unauthorized')),
}));

import { isDefinitivePartyExistenceError } from '../../../src/shared/services/partyExistenceErrors';

describe('isDefinitivePartyExistenceError', () => {
  it('treats session-expired and no-token as definitive (no reconnect)', () => {
    expect(isDefinitivePartyExistenceError(new Error('Сессия устарела. Войдите ещё раз.'))).toBe(
      true,
    );
    expect(
      isDefinitivePartyExistenceError(
        new Error('Для получения данных вечеринки необходимо войти в аккаунт'),
      ),
    ).toBe(true);
  });

  it('treats invalid party id as definitive', () => {
    expect(
      isDefinitivePartyExistenceError(new Error('Некорректный идентификатор вечеринки')),
    ).toBe(true);
  });

  it('does not treat network failures as definitive', () => {
    expect(isDefinitivePartyExistenceError(new Error('Failed to fetch'))).toBe(false);
    expect(isDefinitivePartyExistenceError(new Error('timeout'))).toBe(false);
  });
});
