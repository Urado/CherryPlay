import { renderHook, waitFor } from '@testing-library/react';

import { clearServerUrlCache } from '../../src/shared/config/serverConfig';
import {
  resetDesktopCompatibilityWarningForTests,
  useDesktopCompatibilityWarning,
} from '../../src/shared/hooks/useDesktopCompatibilityWarning';
import { resetPlatformForTests, setPlatform } from '../../src/shared/platform/platformContext';
import type { PlatformAPI } from '../../src/shared/platform/types';
import { useSettingsStore } from '../../src/shared/stores/settingsStore';

const originalFetch = global.fetch;
const fetchMock = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>();
const invokeMock = jest.fn(() =>
  Promise.resolve({ success: true, data: 'https://server.test' }),
);
const platform = { invoke: invokeMock } as unknown as PlatformAPI;

describe('useDesktopCompatibilityWarning updateVersion cache', () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetDesktopCompatibilityWarningForTests();
    fetchMock.mockReset();
    global.fetch = fetchMock;
    invokeMock.mockClear();
    clearServerUrlCache();
    useSettingsStore.setState({ enableStreaming: true, _hasHydrated: true });
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    setPlatform(platform, 'electron');
  });

  afterEach(() => {
    global.fetch = originalFetch;
    clearServerUrlCache();
    resetPlatformForTests();
  });

  it('does not overwrite a known updateVersion with null on a later success', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          desktopCompatibilityWarning: null,
          desktopUpdateVersion: '0.8.0',
        }),
    } as Response);

    const { unmount } = renderHook(() => useDesktopCompatibilityWarning(false));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    unmount();

    fetchMock.mockReset();
    fetchMock.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          desktopCompatibilityWarning: null,
          desktopUpdateVersion: null,
        }),
    } as Response);

    const { result } = renderHook(() => useDesktopCompatibilityWarning(false));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await waitFor(() => expect(result.current.updateVersion).toBe('0.8.0'));
  });
});
