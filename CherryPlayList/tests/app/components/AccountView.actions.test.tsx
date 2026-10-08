import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';

const mockGetWebBaseUrl = jest.fn();
const mockInvoke = jest.fn();
const mockAddNotification = jest.fn();
const mockOnClose = jest.fn();
const mockLogout = jest.fn();

jest.mock('@cherryplay/components', () => {
  const ReactActual = jest.requireActual<typeof import('react')>('react');
  return {
    AuthForm: () => null,
    Button: ({
      children,
      loading: _loading,
      variant: _variant,
      size: _size,
      ...props
    }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
      variant?: string;
      size?: string;
      loading?: boolean;
    }) => ReactActual.createElement('button', { type: 'button', ...props }, children),
  };
});

jest.mock('@shared/components', () => ({ OnlineUnavailablePanel: () => null }));
jest.mock('@shared/demo/demoAuthFixture', () => ({ DEMO_ORGANIZER_DTO: { id: 'demo', name: 'Demo' } }));
jest.mock('@shared/platform', () => ({
  getAppMode: () => 'production',
  getPlatform: () => ({ invoke: (...args: unknown[]) => mockInvoke(...args) }),
  getPlatformCapabilities: () => ({ supportsRealAuth: true }),
  isDemoFixturesMode: () => false,
  isDemoLiveMode: () => false,
}));
jest.mock('@shared/config/serverConfig', () => ({
  getWebBaseUrl: (...args: unknown[]) => mockGetWebBaseUrl(...args),
}));
jest.mock('@shared/services/authService', () => ({
  authService: {
    getCurrentOrganizer: jest.fn().mockResolvedValue({ id: 'org-1', name: 'Org One' }),
    logout: (...args: unknown[]) => mockLogout(...args),
  },
}));
jest.mock('@shared/stores', () => ({
  useClientOutdatedStore: () => ({ isOutdated: false, requiredVersion: null }),
  useUIStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      addNotification: mockAddNotification,
    }),
}));

const authStoreState = {
  accessToken: 'tok',
  organizer: { id: 'org-1', name: 'Org One' },
  isAuthenticated: () => true,
  setOrganizer: jest.fn(),
};

jest.mock('@shared/stores/authStore', () => {
  const useAuthStore = Object.assign(
    (selector: (state: typeof authStoreState) => unknown) => selector(authStoreState),
    { getState: () => authStoreState },
  );
  return { useAuthStore };
});

jest.mock('@shared/utils/authSession', () => ({ clearAuthSession: jest.fn() }));
jest.mock('@app/components/BrowserLoginPanel', () => ({ BrowserLoginPanel: () => null }));

import { AccountView } from '@app/components/AccountView';

describe('AccountView actions', () => {
  beforeEach(() => {
    mockGetWebBaseUrl.mockReset().mockResolvedValue('https://cherryplay.example/');
    mockInvoke.mockReset().mockResolvedValue(undefined);
    mockAddNotification.mockReset();
    mockOnClose.mockReset();
    mockLogout.mockReset().mockResolvedValue(undefined);
  });

  it('shows only website cabinet and logout actions', () => {
    render(<AccountView />);

    expect(screen.getAllByRole('button')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'Привязать существующую вечеринку' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Открыть кабинет на сайте' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Выйти' })).toBeVisible();
  });

  it('opens the cabinet route on the website', async () => {
    render(<AccountView />);
    fireEvent.click(screen.getByRole('button', { name: 'Открыть кабинет на сайте' }));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('auth:openExternal', {
        url: 'https://cherryplay.example/cabinet',
      });
    });
  });

  it('logs out and closes the account popover', async () => {
    render(<AccountView onClose={mockOnClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Выйти' }));

    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalledTimes(1);
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });
});
