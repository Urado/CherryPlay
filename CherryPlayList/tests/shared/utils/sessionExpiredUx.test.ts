const addNotificationMock = jest.fn();
const closeModalMock = jest.fn();
const clearAuthSessionMock = jest.fn();

jest.mock('@shared/stores/uiStore', () => ({
  useUIStore: {
    getState: () => ({
      modal: 'partySettings' as const,
      addNotification: addNotificationMock,
      closeModal: closeModalMock,
    }),
  },
}));

jest.mock('@shared/utils/authSession', () => ({
  clearAuthSession: (...args: unknown[]) => clearAuthSessionMock(...args),
}));

import {
  handleAuthError,
  SESSION_EXPIRED_USER_MESSAGE,
} from '@shared/utils/authErrorHandler';
import { isSessionAuthError } from '@shared/utils/apiErrorHandler';

describe('session expired UX', () => {
  beforeEach(() => {
    addNotificationMock.mockClear();
    closeModalMock.mockClear();
    clearAuthSessionMock.mockClear();
  });

  it('handleAuthError always notifies with Russian session message', () => {
    handleAuthError('Session not found or expired');

    expect(clearAuthSessionMock).toHaveBeenCalledTimes(1);
    expect(closeModalMock).toHaveBeenCalledTimes(1);
    expect(addNotificationMock).toHaveBeenCalledWith({
      type: 'error',
      message: SESSION_EXPIRED_USER_MESSAGE,
      duration: 8000,
    });
  });

  it('handleAuthError closes any open modal, not only account', () => {
    handleAuthError('gone');
    expect(closeModalMock).toHaveBeenCalledTimes(1);
  });

  it('isSessionAuthError treats 401 and bare 403 as session loss', () => {
    expect(isSessionAuthError(401)).toBe(true);
    expect(isSessionAuthError(403)).toBe(true);
    expect(isSessionAuthError(403, 'forbidden')).toBe(true);
  });

  it('isSessionAuthError skips business 403 codes', () => {
    expect(isSessionAuthError(403, 'consent_required')).toBe(false);
    expect(isSessionAuthError(403, 'theme_not_entitled')).toBe(false);
    expect(isSessionAuthError(403, 'theme_not_visible')).toBe(false);
    expect(isSessionAuthError(403, 'admin_only')).toBe(false);
    expect(isSessionAuthError(404)).toBe(false);
  });
});
