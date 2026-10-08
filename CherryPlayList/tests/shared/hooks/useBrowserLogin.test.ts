import { act, renderHook, waitFor } from '@testing-library/react';

const startBrowserLoginMock = jest.fn();
const invokeMock = jest.fn();
const isPlatformInitializedMock = jest.fn(() => true);
const getAppModeMock = jest.fn(() => 'electron');
const getPlatformMock = jest.fn(() => ({ invoke: invokeMock }));

const beginBrowserLoginFlow = jest.fn();
const completeBrowserLoginFlow = jest.fn();
const failBrowserLoginFlow = jest.fn();
const resetBrowserLoginFlow = jest.fn();
const getBrowserLoginFlowState = jest.fn(() => ({ status: 'idle', error: null }));
const subscribeBrowserLoginFlow = jest.fn((listener: () => void) => {
  return () => undefined;
});

jest.mock('@shared/services/authService', () => ({
  authService: {
    startBrowserLogin: (...args: unknown[]) => startBrowserLoginMock(...args),
  },
}));

jest.mock('@shared/platform', () => ({
  getAppMode: () => getAppModeMock(),
  getPlatform: () => getPlatformMock(),
  isPlatformInitialized: () => isPlatformInitializedMock(),
}));

jest.mock('@shared/auth/browserLoginFlow', () => ({
  beginBrowserLoginFlow: (...args: unknown[]) => beginBrowserLoginFlow(...args),
  completeBrowserLoginFlow: (...args: unknown[]) => completeBrowserLoginFlow(...args),
  failBrowserLoginFlow: (...args: unknown[]) => failBrowserLoginFlow(...args),
  resetBrowserLoginFlow: (...args: unknown[]) => resetBrowserLoginFlow(...args),
  getBrowserLoginFlowState: () => getBrowserLoginFlowState(),
  subscribeBrowserLoginFlow: (listener: () => void) => subscribeBrowserLoginFlow(listener),
}));

const isAuthenticatedMock = jest.fn(() => false);

jest.mock('@shared/stores/authStore', () => ({
  useAuthStore: (selector: (state: { isAuthenticated: () => boolean }) => unknown) =>
    selector({ isAuthenticated: () => isAuthenticatedMock() }),
}));

import { useBrowserLogin } from '@shared/hooks/useBrowserLogin';

describe('useBrowserLogin', () => {
  beforeEach(() => {
    startBrowserLoginMock.mockReset();
    invokeMock.mockReset();
    beginBrowserLoginFlow.mockClear();
    completeBrowserLoginFlow.mockClear();
    failBrowserLoginFlow.mockClear();
    resetBrowserLoginFlow.mockClear();
    subscribeBrowserLoginFlow.mockClear();
    isPlatformInitializedMock.mockReturnValue(true);
    getAppModeMock.mockReturnValue('electron');
    getBrowserLoginFlowState.mockReturnValue({ status: 'idle', error: null });
    isAuthenticatedMock.mockReturnValue(false);
    startBrowserLoginMock.mockResolvedValue(undefined);
    invokeMock.mockResolvedValue({ success: true });
  });

  it('startLogin: cancel IPC → begin → startBrowserLogin', async () => {
    getBrowserLoginFlowState.mockReturnValue({ status: 'waiting', error: null });
    const { result } = renderHook(() => useBrowserLogin());

    await act(async () => {
      await result.current.startLogin();
    });

    expect(invokeMock).toHaveBeenCalledWith('auth:cancelCallback');
    expect(beginBrowserLoginFlow).toHaveBeenCalled();
    expect(startBrowserLoginMock).toHaveBeenCalledTimes(1);
  });

  it('openBrowser failure → failBrowserLoginFlow', async () => {
    startBrowserLoginMock.mockRejectedValueOnce(new Error('Failed to open browser'));
    const { result } = renderHook(() => useBrowserLogin());

    await act(async () => {
      await result.current.startLogin();
    });

    expect(failBrowserLoginFlow).toHaveBeenCalledWith('Failed to open browser');
  });

  it('authenticated while waiting → complete', async () => {
    getBrowserLoginFlowState.mockReturnValue({ status: 'waiting', error: null });
    isAuthenticatedMock.mockReturnValue(true);

    renderHook(() => useBrowserLogin());

    await waitFor(() => {
      expect(completeBrowserLoginFlow).toHaveBeenCalled();
    });
  });

  it('retryLogin resets and starts again', async () => {
    const { result } = renderHook(() => useBrowserLogin());

    await act(async () => {
      result.current.retryLogin();
    });

    expect(resetBrowserLoginFlow).toHaveBeenCalled();
    await waitFor(() => {
      expect(startBrowserLoginMock).toHaveBeenCalled();
    });
  });

  it('cancelWaiting invokes auth:cancelCallback and resets', () => {
    const { result } = renderHook(() => useBrowserLogin());

    act(() => {
      result.current.cancelWaiting();
    });

    expect(invokeMock).toHaveBeenCalledWith('auth:cancelCallback');
    expect(resetBrowserLoginFlow).toHaveBeenCalled();
  });

  it('cancel IPC no-op when platform not ready', async () => {
    isPlatformInitializedMock.mockReturnValue(false);
    const { result } = renderHook(() => useBrowserLogin());

    await act(async () => {
      await result.current.startLogin();
    });

    expect(invokeMock).not.toHaveBeenCalled();
    expect(startBrowserLoginMock).toHaveBeenCalledTimes(1);
  });

  it('cancel IPC no-op when not electron', async () => {
    getAppModeMock.mockReturnValue('demo');
    const { result } = renderHook(() => useBrowserLogin());

    await act(async () => {
      await result.current.startLogin();
    });

    expect(invokeMock).not.toHaveBeenCalled();
    expect(startBrowserLoginMock).toHaveBeenCalledTimes(1);
  });
});
