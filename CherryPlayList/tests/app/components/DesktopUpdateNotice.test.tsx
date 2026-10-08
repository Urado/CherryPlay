import { act, fireEvent, render, screen } from '@testing-library/react';

import { DesktopUpdateNotice } from '../../../src/app/components/DesktopUpdateNotice';
import { resetPlatformForTests, setPlatform } from '../../../src/shared/platform/platformContext';
import type { PlatformAPI } from '../../../src/shared/platform/types';
import { checkLatestDesktopUpdate } from '../../../src/shared/services/desktopUpdateService';
import { useClientOutdatedStore } from '../../../src/shared/stores/clientOutdatedStore';
import { useProjectStore } from '../../../src/shared/stores/projectStore';
import { apiFetch, CLIENT_OUTDATED_CODE, CLIENT_OUTDATED_STATUS } from '../../../src/shared/utils/apiFetch';

jest.mock('@shared/config', () => ({ APP_VERSION: '0.7.0' }));
jest.mock('@shared/services/desktopUpdateService', () => {
  const actual = jest.requireActual('@shared/services/desktopUpdateService');
  return { ...actual, checkLatestDesktopUpdate: jest.fn() };
});

const checkUpdateMock = jest.mocked(checkLatestDesktopUpdate);
const originalFetch = global.fetch;
const invokeMock = jest.fn(async (channel: string) => ({
  success: true as const,
  data: channel === 'config:getWebBaseUrl' ? 'https://example.test' : undefined,
}));
const testPlatform = {
  getPathForFile: () => '',
  invoke: invokeMock,
  on: () => () => undefined,
  aimp: {
    getState: async () => ({ success: true as const }),
    setSourceSelection: async () => ({ success: true as const }),
    setLiveStreamStarted: async () => ({ success: true as const }),
    onStateChanged: () => () => undefined,
    onLog: () => () => undefined,
  },
} as unknown as PlatformAPI;

const setPartySession = (active: boolean) => {
  useProjectStore.setState((state) => ({
    ...state,
    sessionState: { ...state.sessionState, mode: active ? 'session' : 'preparation' },
    meta: {
      ...state.meta,
      linkedParty: active ? { id: 'party-id', shortCode: 'party' } : null,
    },
  }));
};

const flushPromises = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

const outdatedResponse = (): Response => ({
  ok: false,
  status: CLIENT_OUTDATED_STATUS,
  statusText: 'Upgrade Required',
  clone: () => outdatedResponse(),
  text: async () => JSON.stringify({ code: CLIENT_OUTDATED_CODE, requiredVersion: '0.8.0' }),
} as Response);

describe('DesktopUpdateNotice', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    window.localStorage.clear();
    setPartySession(false);
    useClientOutdatedStore.getState().resetOutdated();
    checkUpdateMock.mockReset();
    checkUpdateMock.mockResolvedValue({ success: true, update: { version: '0.8.0' } });
    invokeMock.mockClear();
    setPlatform(testPlatform, 'electron');
  });

  afterEach(() => {
    resetPlatformForTests();
    global.fetch = originalFetch;
    jest.useRealTimers();
  });

  it('checks on startup, throttles successful checks for 24 hours, and retries failures sooner', async () => {
    const view = render(<DesktopUpdateNotice />);
    await flushPromises();
    expect(checkUpdateMock).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Доступна новая версия: 0.8.0')).toBeInTheDocument();

    jest.setSystemTime(new Date('2026-01-01T23:58:00.000Z'));
    await act(async () => {
      await jest.advanceTimersByTimeAsync(60_000);
    });
    expect(checkUpdateMock).toHaveBeenCalledTimes(1);
    jest.setSystemTime(new Date('2026-01-02T00:00:00.000Z'));
    await act(async () => {
      await jest.advanceTimersByTimeAsync(60_000);
    });
    expect(checkUpdateMock).toHaveBeenCalledTimes(2);

    view.unmount();
    window.localStorage.clear();
    checkUpdateMock.mockReset();
    checkUpdateMock.mockResolvedValueOnce({ success: false });
    checkUpdateMock.mockResolvedValueOnce({ success: true, update: null });
    render(<DesktopUpdateNotice />);
    await flushPromises();
    expect(window.localStorage.getItem('cherryplay-desktop-update-last-checked')).toBeNull();
    await act(async () => {
      await jest.advanceTimersByTimeAsync(5 * 60 * 1000);
    });
    expect(checkUpdateMock).toHaveBeenCalledTimes(2);
  });

  it('defers checks during an active linked party session and checks after it ends', async () => {
    setPartySession(true);
    const view = render(<DesktopUpdateNotice />);
    await flushPromises();
    await act(async () => {
      await jest.advanceTimersByTimeAsync(60_000);
    });
    expect(checkUpdateMock).not.toHaveBeenCalled();

    act(() => setPartySession(false));
    view.rerender(<DesktopUpdateNotice />);
    await flushPromises();
    expect(checkUpdateMock).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Доступна новая версия: 0.8.0')).toBeInTheDocument();
  });

  it('does not show a soft notice when the available release is the current version', async () => {
    checkUpdateMock.mockResolvedValue({ success: true, update: { version: '0.7.0' } });
    render(<DesktopUpdateNotice />);

    await flushPromises();

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('keeps the app usable when the release check fails', async () => {
    checkUpdateMock.mockResolvedValue({ success: false });
    render(<DesktopUpdateNotice />);

    await flushPromises();

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('persists dismissal for one version and shows a newer release', async () => {
    const view = render(<DesktopUpdateNotice />);
    await flushPromises();
    fireEvent.click(screen.getByRole('button', { name: 'Скрыть уведомление об обновлении' }));
    expect(window.localStorage.getItem('cherryplay-desktop-update-dismissed-version')).toBe(
      '0.8.0',
    );
    expect(screen.queryByText('Доступна новая версия: 0.8.0')).not.toBeInTheDocument();

    view.unmount();
    window.localStorage.setItem('cherryplay-desktop-update-last-checked', '0');
    checkUpdateMock.mockResolvedValue({ success: true, update: { version: '0.9.0' } });
    render(<DesktopUpdateNotice />);
    await flushPromises();
    expect(screen.getByText('Доступна новая версия: 0.9.0')).toBeInTheDocument();
  });

  it('shows a non-dismissible required update during a party session and opens downloads', async () => {
    setPartySession(true);
    window.localStorage.setItem('cherryplay-desktop-update-dismissed-version', '0.8.0');
    useClientOutdatedStore.getState().markOutdated('0.8.0');
    render(<DesktopUpdateNotice />);

    expect(screen.getByRole('alert')).toHaveTextContent('Требуется обновление приложения до 0.8.0.');
    expect(screen.getByRole('button', { name: 'Скачать обновление' })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Скрыть уведомление об обновлении' }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Скачать обновление' }));
    await flushPromises();
    expect(invokeMock).toHaveBeenCalledWith('system:openExternal', {
      url: 'https://example.test/download',
    });
    expect(checkUpdateMock).not.toHaveBeenCalled();
  });

  it('shows the mandatory notice when an API request reports an outdated client', async () => {
    global.fetch = jest.fn().mockResolvedValue(outdatedResponse());
    render(<DesktopUpdateNotice />);

    await act(async () => {
      await apiFetch('/api/parties');
    });

    expect(screen.getByRole('alert')).toHaveTextContent('Требуется обновление приложения до 0.8.0.');
  });
});
