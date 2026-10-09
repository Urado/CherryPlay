import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import { DesktopUpdateNotice } from '../../../src/app/components/DesktopUpdateNotice';
import { clearServerUrlCache } from '../../../src/shared/config/serverConfig';
import { resetDesktopCompatibilityWarningForTests } from '../../../src/shared/hooks/useDesktopCompatibilityWarning';
import { isDemoLiveMode } from '../../../src/shared/platform/demoLiveMode';
import { resetPlatformForTests, setPlatform } from '../../../src/shared/platform/platformContext';
import type { PlatformAPI } from '../../../src/shared/platform/types';
import { checkLatestDesktopUpdate } from '../../../src/shared/services/desktopUpdateService';
import { useClientOutdatedStore } from '../../../src/shared/stores/clientOutdatedStore';
import { useProjectStore } from '../../../src/shared/stores/projectStore';
import { useSettingsStore } from '../../../src/shared/stores/settingsStore';

jest.mock('@shared/config', () => ({ APP_VERSION: '0.7.0' }));
jest.mock('@shared/platform/demoLiveMode', () => ({ isDemoLiveMode: jest.fn() }));
jest.mock('@shared/services/desktopUpdateService', () => ({
  ...jest.requireActual<typeof import('../../../src/shared/services/desktopUpdateService')>(
    '@shared/services/desktopUpdateService',
  ),
  checkLatestDesktopUpdate: jest.fn(),
}));

const originalFetch = global.fetch;
const fetchMock = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>();
let serverUrl = '';
const invokeMock = jest.fn((channel: string) =>
  Promise.resolve({
    success: true,
    data:
      channel === 'config:getServerUrl'
        ? serverUrl
        : channel === 'config:getWebBaseUrl'
          ? 'https://web.test'
          : undefined,
  }),
);
const platform = { invoke: invokeMock } as unknown as PlatformAPI;
const setSession = (active: boolean) => {
  useProjectStore.setState((state) => ({
    sessionState: { ...state.sessionState, mode: active ? 'session' : 'preparation' },
    meta: { ...state.meta, linkedParty: active ? { id: 'party', shortCode: 'party' } : null },
  }));
};

describe('desktop compatibility in browser Live mode', () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetDesktopCompatibilityWarningForTests();
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          desktopCompatibilityWarning: { minVersion: '0.8.0', serverVersion: '0.9.0' },
            desktopUpdateVersion: '0.8.0',
        }),
    } as Response);
    global.fetch = fetchMock;
    invokeMock.mockClear();
    jest
      .mocked(checkLatestDesktopUpdate)
      .mockReset()
      .mockResolvedValue({ success: true, update: { version: '0.8.0' } });
    jest.mocked(isDemoLiveMode).mockReturnValue(true);
    serverUrl = '';
    clearServerUrlCache();
    useSettingsStore.setState({ enableStreaming: true, _hasHydrated: true });
    useClientOutdatedStore.getState().resetOutdated();
    setSession(false);
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    setPlatform(platform, 'demo');
  });

  afterEach(() => {
    global.fetch = originalFetch;
    clearServerUrlCache();
    resetPlatformForTests();
  });

  it.each(['', 'https://server.test'])(
    'uses server URL %s and exposes the download action',
    async (configuredUrl) => {
      serverUrl = configuredUrl;
      render(<DesktopUpdateNotice />);
      await waitFor(() =>
        expect(fetchMock).toHaveBeenCalledWith(
          `${configuredUrl}/api/config`,
          expect.objectContaining({ credentials: 'omit' }),
        ),
      );
      expect(await screen.findByText(/С версии сайта 0.9.0/)).toBeInTheDocument();
      expect(await screen.findByText('Доступна новая версия: 0.8.0')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Скачать обновление' }));
      await waitFor(() =>
        expect(invokeMock).toHaveBeenCalledWith('system:openExternal', {
          url: 'https://web.test/download',
        }),
      );
      expect(checkLatestDesktopUpdate).not.toHaveBeenCalled();
    },
  );

  it('does not fetch or render cached warnings in fixtures even with a configured server', async () => {
    serverUrl = 'https://server.test';
    jest.mocked(isDemoLiveMode).mockReturnValue(false);
    render(<DesktopUpdateNotice />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(checkLatestDesktopUpdate).not.toHaveBeenCalled();
  });

  it('does not enable compatibility checks for Capacitor', async () => {
    setPlatform(platform, 'capacitor');
    render(<DesktopUpdateNotice />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('waits for hydrated Online mode and linked session completion', async () => {
    useSettingsStore.setState({ _hasHydrated: false, enableStreaming: false });
    setSession(true);
    render(<DesktopUpdateNotice />);
    await act(async () => {
      useSettingsStore.setState({ _hasHydrated: true });
      await Promise.resolve();
    });
    expect(fetchMock).not.toHaveBeenCalled();
    await act(async () => {
      useSettingsStore.setState({ enableStreaming: true });
      await Promise.resolve();
    });
    expect(fetchMock).not.toHaveBeenCalled();
    await act(async () => {
      setSession(false);
      await Promise.resolve();
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/С версии сайта 0.9.0/)).toBeInTheDocument();
    await act(async () => {
      setSession(true);
      await Promise.resolve();
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('waits for browser connectivity and aborts when Online is disabled', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    fetchMock.mockImplementation(
      (_url, options) =>
        new Promise<Response>((_resolve, reject) => {
          options?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );
    render(<DesktopUpdateNotice />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(fetchMock).not.toHaveBeenCalled();
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    fireEvent(window, new Event('online'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await act(async () => {
      useSettingsStore.setState({ enableStreaming: false });
      await Promise.resolve();
    });
    expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
