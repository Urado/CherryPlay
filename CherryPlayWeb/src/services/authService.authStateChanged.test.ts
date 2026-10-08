import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { setDesktopClientMode } from '../utils/desktopClientMode';

import { AUTH_STATE_CHANGED_EVENT, authService } from './authService';

const mocks = vi.hoisted(() => ({ apiFetch: vi.fn() }));

vi.mock('../utils/apiFetch', () => ({ apiFetch: mocks.apiFetch }));

describe('authService auth state events', () => {
  beforeEach(() => {
    setDesktopClientMode(false);
    mocks.apiFetch.mockReset();
    mocks.apiFetch.mockResolvedValue({ ok: true, status: 200 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('notifies listeners after successful login', async () => {
    const listener = vi.fn();
    window.addEventListener(AUTH_STATE_CHANGED_EVENT, listener);

    await authService.login('organizer@example.com', 'secret');

    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener(AUTH_STATE_CHANGED_EVENT, listener);
  });

  it('notifies listeners after logout', async () => {
    const listener = vi.fn();
    window.addEventListener(AUTH_STATE_CHANGED_EVENT, listener);

    await authService.logout();

    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener(AUTH_STATE_CHANGED_EVENT, listener);
  });
});
