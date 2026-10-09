import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import { DesktopUpdateNotice } from '../../../src/app/components/DesktopUpdateNotice';
import { getWebBaseUrl } from '../../../src/shared/config/serverConfig';
import { resetDesktopCompatibilityWarningForTests } from '../../../src/shared/hooks/useDesktopCompatibilityWarning';
import { resetPlatformForTests, setPlatform } from '../../../src/shared/platform/platformContext';
import type { PlatformAPI } from '../../../src/shared/platform/types';
import { checkLatestDesktopUpdate } from '../../../src/shared/services/desktopUpdateService';
import { useClientOutdatedStore } from '../../../src/shared/stores/clientOutdatedStore';
import { useProjectStore } from '../../../src/shared/stores/projectStore';
import { useUIStore } from '../../../src/shared/stores/uiStore';

jest.mock('@shared/config', () => ({ APP_VERSION: '0.7.0' }));
jest.mock('@shared/config/serverConfig', () => ({
  getServerUrl: jest.fn().mockResolvedValue('https://server.test'),
  getWebBaseUrl: jest.fn(),
}));
jest.mock('@shared/services/desktopUpdateService', () => ({
  ...jest.requireActual<typeof import('../../../src/shared/services/desktopUpdateService')>(
    '@shared/services/desktopUpdateService',
  ),
  checkLatestDesktopUpdate: jest.fn(),
}));

const invokeMock = jest.fn();
const addNotificationMock = jest.fn();

describe('DesktopUpdateNotice render prop and download errors', () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetDesktopCompatibilityWarningForTests();
    addNotificationMock.mockReset();
    invokeMock.mockReset();
    invokeMock.mockResolvedValue({ success: true });
    jest.mocked(getWebBaseUrl).mockResolvedValue('https://web.test');
    jest
      .mocked(checkLatestDesktopUpdate)
      .mockResolvedValue({ success: true, update: { version: '0.8.0' } });
    useClientOutdatedStore.getState().resetOutdated();
    useProjectStore.setState((state) => ({
      sessionState: { ...state.sessionState, mode: 'preparation' },
      meta: { ...state.meta, linkedParty: null },
    }));
    useUIStore.setState({ addNotification: addNotificationMock });
    setPlatform({ invoke: invokeMock } as unknown as PlatformAPI, 'electron');
  });

  afterEach(() => {
    resetPlatformForTests();
  });

  it('uses the short AppHeader label and keeps version in the download aria-label', async () => {
    render(
      <DesktopUpdateNotice>
        {({ releaseNotice }) => <div data-testid="header-slot">{releaseNotice}</div>}
      </DesktopUpdateNotice>,
    );

    expect(await screen.findByText('Обновление 0.8.0')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Скачать обновление 0.8.0' }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('header-slot')).toContainElement(
      screen.getByText('Обновление 0.8.0'),
    );
  });

  it('notifies when opening the download page fails', async () => {
    invokeMock.mockRejectedValue(new Error('blocked'));
    render(<DesktopUpdateNotice />);

    expect(await screen.findByText('Доступна новая версия: 0.8.0')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Скачать обновление 0.8.0' }));

    await waitFor(() =>
      expect(addNotificationMock).toHaveBeenCalledWith({
        type: 'error',
        message: 'Не удалось открыть страницу загрузки',
      }),
    );
  });

  it('notifies when resolving the download URL fails', async () => {
    jest.mocked(getWebBaseUrl).mockRejectedValue(new Error('no url'));
    render(<DesktopUpdateNotice />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Скачать обновление 0.8.0' }));

    await waitFor(() =>
      expect(addNotificationMock).toHaveBeenCalledWith({
        type: 'error',
        message: 'Не удалось открыть страницу загрузки',
      }),
    );
  });
});
