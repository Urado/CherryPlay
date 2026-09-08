import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';

const getWebBaseUrlMock = jest.fn();
const invokeMock = jest.fn();
const addNotificationMock = jest.fn();

jest.mock('@cherryplay/components', () => {
  const ReactActual = jest.requireActual<typeof import('react')>('react');
  return {
    Disclosure: ({
      title,
      children,
    }: {
      title: string;
      children?: React.ReactNode;
      className?: string;
      expanded?: boolean;
      onExpandedChange?: (v: boolean) => void;
    }) =>
      ReactActual.createElement(
        'div',
        null,
        ReactActual.createElement('h3', null, title),
        children,
      ),
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
    ChangePasswordForm: () => null,
  };
});

jest.mock('@shared/components', () => ({
  OnlineUnavailablePanel: () => null,
}));

jest.mock('@shared/demo/demoAuthFixture', () => ({
  DEMO_ORGANIZER_DTO: { id: 'demo', name: 'Demo' },
  getDemoOrganizerDto: () => ({
    id: 'demo',
    name: 'Demo',
    createdAt: '2024-01-01',
    logoUrl: null,
  }),
}));

jest.mock('@shared/platform', () => ({
  getAppMode: () => 'production',
  getPlatform: () => ({ invoke: (...args: unknown[]) => invokeMock(...args) }),
  getPlatformCapabilities: () => ({ supportsRealAuth: true }),
  isDemoFixturesMode: () => false,
  isDemoLiveMode: () => false,
}));

jest.mock('@shared/config/serverConfig', () => ({
  getWebBaseUrl: (...args: unknown[]) => getWebBaseUrlMock(...args),
}));

jest.mock('@shared/services/authService', () => ({
  authService: {
    getCurrentOrganizer: jest.fn().mockResolvedValue({
      id: 'org-1',
      name: 'Org One',
      createdAt: '2024-01-01T00:00:00Z',
      logoUrl: null,
    }),
    logout: jest.fn(),
  },
}));

jest.mock('@shared/stores', () => ({
  useClientOutdatedStore: () => ({ isOutdated: false, requiredVersion: null }),
  useUIStore: (
    selector: (s: {
      addNotification: typeof addNotificationMock;
      closeModal: () => void;
    }) => unknown,
  ) => selector({ addNotification: addNotificationMock, closeModal: jest.fn() }),
}));

const authStoreState = {
  accessToken: 'tok',
  organizer: { id: 'org-1', name: 'Org One' },
  isAuthenticated: () => true,
  setOrganizer: jest.fn(),
};

jest.mock('@shared/stores/authStore', () => {
  const useAuthStore = Object.assign(
    (selector: (s: typeof authStoreState) => unknown) => selector(authStoreState),
    { getState: () => authStoreState },
  );
  return { useAuthStore };
});

jest.mock('@shared/utils/authSession', () => ({
  clearAuthSession: jest.fn(),
}));

jest.mock('@app/components/BrowserLoginPanel', () => ({
  BrowserLoginPanel: () => null,
}));

jest.mock('@app/components/MyPartiesList', () => ({
  MyPartiesList: () => null,
}));

import { AccountView } from '@app/components/AccountView';

describe('AccountView privacy link', () => {
  beforeEach(() => {
    getWebBaseUrlMock.mockReset();
    invokeMock.mockReset();
    addNotificationMock.mockReset();
    getWebBaseUrlMock.mockResolvedValue('https://cherryplay.example');
    invokeMock.mockResolvedValue(undefined);
  });

  it('shows short CTA with browser aria-label and opens external cabinet URL', async () => {
    render(<AccountView />);

    const button = await screen.findByRole('button', {
      name: 'Открыть управление аккаунтом на сайте в браузере',
    });
    expect(button).toHaveTextContent('Открыть кабинет на сайте');
    expect(screen.getByText('Откроется в браузере')).toBeInTheDocument();
    expect(screen.getByText(/Удаление аккаунта и согласия/)).toBeInTheDocument();

    fireEvent.click(button);

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('auth:openExternal', {
        url: 'https://cherryplay.example/cabinet#account',
      });
    });
  });
});
