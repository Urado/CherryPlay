import { useBrowserLogin } from '@shared/hooks/useBrowserLogin';
import { act, renderHook, waitFor } from '@testing-library/react';

const startBrowserLoginMock = jest.fn<Promise<void>, unknown[]>();
const invokeMock = jest.fn<Promise<{ success: boolean }>, unknown[]>();
const isPlatformInitializedMock = jest.fn<boolean, []>(() => true);
const getAppModeMock = jest.fn<'electron' | 'demo', []>(() => 'electron');
const getPlatformMock = jest.fn(() => ({ invoke: invokeMock }));

const beginBrowserLoginFlow = jest.fn<void, unknown[]>();
const completeBrowserLoginFlow = jest.fn<void, unknown[]>();
const failBrowserLoginFlow = jest.fn<void, unknown[]>();
const resetBrowserLoginFlow = jest.fn<void, unknown[]>();
const getBrowserLoginFlowState = jest.fn<{ status: 'idle' | 'waiting'; error: string | null }, []>(
  () => ({ status: 'idle', error: null }),
);
const subscribeBrowserLoginFlow = jest.fn((_listener: () => void) => {
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

const isAuthenticatedMock = jest.fn<boolean, []>(() => false);

jest.mock('@shared/stores/authStore', () => ({
  useAuthStore: (selector: (state: { isAuthenticated: () => boolean }) => unknown) =>
    selector({ isAuthenticated: () => isAuthenticatedMock() }),
}));

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

    act(() => {
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
