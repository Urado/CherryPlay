const handlers = new Map<string, (event: unknown, payload?: unknown) => Promise<unknown>>();
const openExternalMock = jest.fn();
const fromWebContentsMock = jest.fn(() => null);
const handleMock = jest.fn(
  (channel: string, handler: (event: unknown, payload?: unknown) => Promise<unknown>) => {
    handlers.set(channel, handler);
  },
);

jest.mock('electron', () => ({
  BrowserWindow: {
    fromWebContents: fromWebContentsMock,
  },
  ipcMain: {
    handle: handleMock,
  },
  shell: {
    openExternal: openExternalMock,
  },
}));

import {
  AUTH_CALLBACK_CANCELLED_MESSAGE,
  handleOAuthCallback,
  registerAuthHandlers,
  resetAuthIpcStateForTests,
} from '../../electron/ipc/auth';

describe('auth IPC handlers', () => {
  beforeEach(() => {
    handlers.clear();
    handleMock.mockClear();
    openExternalMock.mockReset();
    fromWebContentsMock.mockReset();
    fromWebContentsMock.mockReturnValue(null);
    resetAuthIpcStateForTests();
    jest.useRealTimers();
    registerAuthHandlers(null);
  });

  afterEach(() => {
    resetAuthIpcStateForTests();
    jest.useRealTimers();
  });

  it('auth:registerCallback resolves on handleOAuthCallback', async () => {
    const register = handlers.get('auth:registerCallback');
    const pending = register?.({ sender: {} });

    handleOAuthCallback('cherryplaylist://auth?code=abc123&state=telegram', null);

    await expect(pending).resolves.toEqual({
      success: true,
      data: { code: 'abc123', provider: 'telegram' },
    });
  });

  it('auth:deliverCallbackUrl resolves pending registerCallback', async () => {
    const register = handlers.get('auth:registerCallback');
    const deliver = handlers.get('auth:deliverCallbackUrl');
    const pending = register?.({ sender: {} });

    const deliverResult = await deliver?.({}, { url: 'cherryplaylist://auth?code=from-deliver' });

    expect(deliverResult).toEqual({ success: true });
    await expect(pending).resolves.toEqual({
      success: true,
      data: { code: 'from-deliver' },
    });
  });

  it('pending URL before register → consume', async () => {
    handleOAuthCallback('cherryplaylist://auth?code=pending-code', null);

    const register = handlers.get('auth:registerCallback');
    await expect(register?.({ sender: {} })).resolves.toEqual({
      success: true,
      data: { code: 'pending-code' },
    });
  });

  it('timeout (3 min) rejects — fake timers', async () => {
    jest.useFakeTimers();
    const register = handlers.get('auth:registerCallback');
    const pending = register?.({ sender: {} });

    jest.advanceTimersByTime(3 * 60 * 1000);

    await expect(pending).rejects.toThrow('OAuth callback timeout');
  });

  it('auth:cancelCallback → cancelled message', async () => {
    const register = handlers.get('auth:registerCallback');
    const cancel = handlers.get('auth:cancelCallback');
    const pending = register?.({ sender: {} });

    await expect(cancel?.({})).resolves.toEqual({ success: true });
    await expect(pending).rejects.toThrow(AUTH_CALLBACK_CANCELLED_MESSAGE);
  });

  it('invalid URL parse → reject', async () => {
    const register = handlers.get('auth:registerCallback');
    const pending = register?.({ sender: {} });

    handleOAuthCallback('cherryplaylist://auth?no-code=1', null);

    await expect(pending).rejects.toThrow('Invalid OAuth callback URL');
  });

  it('auth:openExternal success', async () => {
    openExternalMock.mockResolvedValueOnce(undefined);
    const openExternal = handlers.get('auth:openExternal');

    await expect(openExternal?.({}, { url: 'https://example.com/login' })).resolves.toEqual({
      success: true,
    });
    expect(openExternalMock).toHaveBeenCalledWith('https://example.com/login');
  });

  it('auth:openExternal failure', async () => {
    openExternalMock.mockRejectedValueOnce(new Error('shell failed'));
    const openExternal = handlers.get('auth:openExternal');

    await expect(openExternal?.({}, { url: 'https://example.com/login' })).resolves.toEqual({
      success: false,
      error: 'shell failed',
    });
  });

  it('re-register cancels previous waiter', async () => {
    const register = handlers.get('auth:registerCallback');
    const first = register?.({ sender: {} });
    const second = register?.({ sender: {} });

    await expect(first).rejects.toThrow(AUTH_CALLBACK_CANCELLED_MESSAGE);

    handleOAuthCallback('cherryplaylist://auth?code=second', null);
    await expect(second).resolves.toEqual({
      success: true,
      data: { code: 'second' },
    });
  });
});
