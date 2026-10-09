import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import { DesktopUpdateNotice } from '../../../src/app/components/DesktopUpdateNotice';
import { getServerUrl, getWebBaseUrl } from '../../../src/shared/config/serverConfig';
import { resetDesktopCompatibilityWarningForTests } from '../../../src/shared/hooks/useDesktopCompatibilityWarning';
import { resetPlatformForTests, setPlatform } from '../../../src/shared/platform/platformContext';
import type { PlatformAPI } from '../../../src/shared/platform/types';
import { checkLatestDesktopUpdate } from '../../../src/shared/services/desktopUpdateService';
import { useClientOutdatedStore } from '../../../src/shared/stores/clientOutdatedStore';
import { useProjectStore } from '../../../src/shared/stores/projectStore';
import { useSettingsStore } from '../../../src/shared/stores/settingsStore';

jest.mock('@shared/config', () => ({ APP_VERSION: '0.7.0' }));
jest.mock('@shared/config/serverConfig', () => ({
  getServerUrl: jest.fn(),
  getWebBaseUrl: jest.fn(),
}));
jest.mock('@shared/services/desktopUpdateService', () => ({
  ...jest.requireActual<typeof import('../../../src/shared/services/desktopUpdateService')>(
    '@shared/services/desktopUpdateService',
  ),
  checkLatestDesktopUpdate: jest.fn(),
}));

const fetchMock = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>();
const invokeMock = jest.fn();
const originalFetch = global.fetch;
const setPolicy = (minVersion: string | null, serverVersion = '0.9.0') => {
  fetchMock.mockResolvedValue({
    ok: true,
    json: () =>
      Promise.resolve({
        desktopCompatibilityWarning: minVersion ? { minVersion, serverVersion } : null,
      }),
  } as Response);
};
const setSession = (active: boolean) =>
  useProjectStore.setState((state) => ({
    sessionState: { ...state.sessionState, mode: active ? 'session' : 'preparation' },
    meta: { ...state.meta, linkedParty: active ? { id: 'party', shortCode: 'party' } : null },
  }));

describe('future desktop compatibility notice', () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetDesktopCompatibilityWarningForTests();
    fetchMock.mockReset();
    global.fetch = fetchMock;
    invokeMock.mockReset();
    jest.mocked(getServerUrl).mockResolvedValue('https://server.test');
    jest.mocked(getWebBaseUrl).mockResolvedValue('https://web.test');
    jest
      .mocked(checkLatestDesktopUpdate)
      .mockResolvedValue({ success: true, update: { version: '0.9.0' } });
    useClientOutdatedStore.getState().resetOutdated();
    useSettingsStore.setState({ enableStreaming: true, _hasHydrated: true });
    setSession(false);
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    setPlatform({ invoke: invokeMock } as unknown as PlatformAPI, 'electron');
    setPolicy('0.8.0');
  });

  afterEach(() => {
    global.fetch = originalFetch;
    resetPlatformForTests();
    jest.useRealTimers();
  });

  it('shows affected warning above a release and opens downloads', async () => {
    render(<DesktopUpdateNotice />);
    expect(await screen.findByText(/С версии сайта 0.9.0/)).toHaveTextContent(
      'нужны приложения от 0.8.0',
    );
    expect(screen.queryByText('Доступна новая версия: 0.9.0')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Скачать обновление' }));
    await waitFor(() =>
      expect(invokeMock).toHaveBeenCalledWith('system:openExternal', {
        url: 'https://web.test/download',
      }),
    );
    invokeMock.mockRejectedValue(new Error('cannot open'));
    fireEvent.click(screen.getByRole('button', { name: 'Скачать обновление' }));
    await waitFor(() => expect(invokeMock).toHaveBeenCalledTimes(2));
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it.each(['0.7.99', '0.6.99'])('does not warn compatible %s minimum', async (minimum) => {
    setPolicy(minimum);
    render(<DesktopUpdateNotice />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('Доступна новая версия: 0.9.0')).toBeInTheDocument();
    expect(screen.queryByText(/С версии сайта/)).not.toBeInTheDocument();
  });

  it('required update takes priority even during a session', () => {
    useClientOutdatedStore.getState().markOutdated('0.8.0');
    setSession(true);
    render(<DesktopUpdateNotice />);
    expect(screen.getByRole('alert')).toHaveTextContent('Требуется обновление');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not poll in web mode or while browser is offline', async () => {
    setPlatform({ invoke: invokeMock } as unknown as PlatformAPI, 'demo');
    const view = render(<DesktopUpdateNotice />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(fetchMock).not.toHaveBeenCalled();
    view.unmount();
    setPlatform({ invoke: invokeMock } as unknown as PlatformAPI, 'electron');
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    render(<DesktopUpdateNotice />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(fetchMock).not.toHaveBeenCalled();
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    fireEvent(window, new Event('online'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  });

  it('dismisses only this policy for the run across remounts and shows a new policy', async () => {
    setPolicy('0.8.0', '0.10.0');
    const view = render(<DesktopUpdateNotice />);
    await screen.findByText(/С версии сайта 0.10.0/);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Скрыть предупреждение до следующего запуска' }),
    );
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    view.unmount();
    const { unmount } = render(<DesktopUpdateNotice />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(window.localStorage.getItem('cherryplay-desktop-update-dismissed-version')).toBeNull();
    unmount();
    setPolicy('0.8.0', '0.11.0');
    render(<DesktopUpdateNotice />);
    expect(await screen.findByText(/С версии сайта 0.11.0/)).toBeInTheDocument();
  });

  it('postpones until hydration, online mode and session end', async () => {
    useSettingsStore.setState({ _hasHydrated: false, enableStreaming: false });
    setSession(true);
    render(<DesktopUpdateNotice />);
    expect(fetchMock).not.toHaveBeenCalled();
    await act(async () => {
      useSettingsStore.setState({ _hasHydrated: true, enableStreaming: true });
      await Promise.resolve();
    });
    expect(fetchMock).not.toHaveBeenCalled();
    await act(async () => {
      setSession(false);
      await Promise.resolve();
    });
    await screen.findByText(/С версии сайта 0.9.0/);
    await act(async () => {
      useSettingsStore.setState({ enableStreaming: false });
      await Promise.resolve();
    });
    expect(screen.queryByText(/С версии сайта/)).not.toBeInTheDocument();
  });

  it('retains successful warning on failure and clears on successful null', async () => {
    jest.useFakeTimers();
    render(<DesktopUpdateNotice />);
    await act(async () => {
      await jest.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByText(/С версии сайта 0.9.0/)).toBeInTheDocument();
    fetchMock.mockRejectedValue(new Error('offline'));
    await act(async () => {
      await jest.advanceTimersByTimeAsync(300_000);
    });
    expect(screen.getByText(/С версии сайта 0.9.0/)).toBeInTheDocument();
    setPolicy(null);
    await act(async () => {
      await jest.advanceTimersByTimeAsync(300_000);
    });
    expect(screen.queryByText(/С версии сайта/)).not.toBeInTheDocument();
  });

  it('cancels in flight when browser goes offline and ignores a late response', async () => {
    let complete: ((response: Response) => void) | undefined;
    fetchMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    render(<DesktopUpdateNotice />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    fireEvent(window, new Event('offline'));
    expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true);
    await act(async () => {
      complete?.({
        ok: true,
        json: () =>
          Promise.resolve({
            desktopCompatibilityWarning: { minVersion: '1.0.0', serverVersion: '2.0.0' },
          }),
      } as Response);
      await Promise.resolve();
    });
    expect(screen.queryByText(/С версии сайта 2.0.0/)).not.toBeInTheDocument();
  });
});
