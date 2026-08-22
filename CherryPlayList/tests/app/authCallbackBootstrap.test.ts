import {
  beginBrowserLoginFlow,
  getBrowserLoginFlowState,
  resetBrowserLoginFlow,
} from '@shared/auth/browserLoginFlow';
import {
  initializeAuthCallbackBootstrap,
  resetAuthCallbackBootstrapForTests,
} from '@app/authCallbackBootstrap';
import { CapacitorPlatform } from '@shared/platform/capacitorPlatform';
import { resetPlatformForTests, setPlatform } from '@shared/platform/platformContext';
import type { PlatformAPI } from '@shared/platform/types';
import { WebDemoPlatform } from '@shared/platform/webDemoPlatform';
import { useAuthStore } from '@shared/stores/authStore';
import { useUIStore } from '@shared/stores/uiStore';

const exchangeDesktopCodeMock = jest.fn();
const getCurrentOrganizerMock = jest.fn();
const invokeMock = jest.fn();

jest.mock('@shared/services/authService', () => ({
  authService: {
    exchangeDesktopCode: (...args: unknown[]) => exchangeDesktopCodeMock(...args),
    getCurrentOrganizer: (...args: unknown[]) => getCurrentOrganizerMock(...args),
  },
}));

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function createPlatform(): PlatformAPI {
  return {
    getPathForFile: () => '',
    invoke: invokeMock,
    on: () => () => undefined,
    aimp: {
      getState: jest.fn(),
      setSourceSelection: jest.fn(),
      setLiveStreamStarted: jest.fn(),
      onStateChanged: () => () => undefined,
      onLog: () => () => undefined,
    },
  } as unknown as PlatformAPI;
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe('authCallbackBootstrap', () => {
  beforeEach(() => {
    resetAuthCallbackBootstrapForTests();
    resetBrowserLoginFlow();
    useAuthStore.getState().clearAuth();
    useUIStore.setState({ notifications: [] });
    exchangeDesktopCodeMock.mockReset();
    getCurrentOrganizerMock.mockReset();
    invokeMock.mockReset();
    setPlatform(createPlatform(), 'electron');
  });

  afterEach(async () => {
    resetAuthCallbackBootstrapForTests();
    const hang = createDeferred<never>();
    invokeMock.mockImplementation(() => hang.promise);
    await flushMicrotasks();
    resetBrowserLoginFlow();
    useAuthStore.getState().clearAuth();
    resetPlatformForTests();
  });

  it('skips demo auth mode', () => {
    setPlatform(new WebDemoPlatform(), 'demo');
    initializeAuthCallbackBootstrap();
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it('skips non-electron mode', () => {
    setPlatform(new CapacitorPlatform(), 'capacitor');
    initializeAuthCallbackBootstrap();
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it('success: exchange → token → organizer → complete + success toast', async () => {
    beginBrowserLoginFlow();
    exchangeDesktopCodeMock.mockResolvedValueOnce('access-token');
    getCurrentOrganizerMock.mockResolvedValueOnce({ id: 'org-1', name: 'Alice' });

    const secondWait = createDeferred<{ success: false; error: string }>();
    invokeMock
      .mockResolvedValueOnce({ success: true, data: { code: 'desktop-code' } })
      .mockImplementation(() => secondWait.promise);

    initializeAuthCallbackBootstrap();
    await flushMicrotasks();
    await flushMicrotasks();

    expect(exchangeDesktopCodeMock).toHaveBeenCalledWith('desktop-code');
    expect(useAuthStore.getState().accessToken).toBe('access-token');
    expect(useAuthStore.getState().organizer).toEqual({ id: 'org-1', name: 'Alice' });
    expect(getBrowserLoginFlowState().status).toBe('idle');
    expect(useUIStore.getState().notifications.some((n) => n.message === 'Вход выполнен')).toBe(
      true,
    );

    resetAuthCallbackBootstrapForTests();
    secondWait.resolve({ success: false, error: 'stop' });
    await flushMicrotasks();
  });

  it('callback error while waiting → fail + error toast', async () => {
    beginBrowserLoginFlow();
    const secondWait = createDeferred<never>();
    invokeMock
      .mockResolvedValueOnce({ success: false, error: 'OAuth denied' })
      .mockImplementation(() => secondWait.promise);

    initializeAuthCallbackBootstrap();
    await flushMicrotasks();
    await flushMicrotasks();

    expect(getBrowserLoginFlowState()).toEqual({ status: 'failed', error: 'OAuth denied' });
    expect(useUIStore.getState().notifications.some((n) => n.message === 'OAuth denied')).toBe(
      true,
    );

    resetAuthCallbackBootstrapForTests();
    secondWait.reject(new Error('stop'));
    await flushMicrotasks();
  });

  it('cancelled invoke → continue loop without fail', async () => {
    beginBrowserLoginFlow();
    const secondWait = createDeferred<never>();
    invokeMock
      .mockRejectedValueOnce(new Error('OAuth callback cancelled'))
      .mockImplementation(() => secondWait.promise);

    initializeAuthCallbackBootstrap();
    await flushMicrotasks();
    await flushMicrotasks();

    expect(getBrowserLoginFlowState().status).toBe('waiting');
    expect(useUIStore.getState().notifications).toHaveLength(0);
    expect(invokeMock.mock.calls.length).toBeGreaterThanOrEqual(2);

    resetAuthCallbackBootstrapForTests();
    secondWait.reject(new Error('stop'));
    await flushMicrotasks();
  });

  it('timeout → expired message + fail if waiting', async () => {
    beginBrowserLoginFlow();
    const secondWait = createDeferred<never>();
    invokeMock
      .mockRejectedValueOnce(new Error('OAuth callback timeout'))
      .mockImplementation(() => secondWait.promise);

    initializeAuthCallbackBootstrap();
    await flushMicrotasks();
    await flushMicrotasks();

    expect(getBrowserLoginFlowState().status).toBe('failed');
    expect(getBrowserLoginFlowState().error).toContain('Время ожидания истекло');
    expect(
      useUIStore
        .getState()
        .notifications.some((n) => n.message.includes('Время ожидания истекло')),
    ).toBe(true);

    resetAuthCallbackBootstrapForTests();
    secondWait.reject(new Error('stop'));
    await flushMicrotasks();
  });

  it('exchange failure → fail + toast', async () => {
    beginBrowserLoginFlow();
    exchangeDesktopCodeMock.mockRejectedValueOnce(new Error('Code already used'));
    const secondWait = createDeferred<never>();
    invokeMock
      .mockResolvedValueOnce({ success: true, data: { code: 'used-code' } })
      .mockImplementation(() => secondWait.promise);

    initializeAuthCallbackBootstrap();
    await flushMicrotasks();
    await flushMicrotasks();

    expect(getBrowserLoginFlowState()).toEqual({
      status: 'failed',
      error: 'Code already used',
    });
    expect(
      useUIStore.getState().notifications.some((n) => n.message === 'Code already used'),
    ).toBe(true);

    resetAuthCallbackBootstrapForTests();
    secondWait.reject(new Error('stop'));
    await flushMicrotasks();
  });
});
