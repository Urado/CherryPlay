/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LoginPage } from './LoginPage';

vi.mock('../services/authService', () => ({
  authService: {
    checkAuth: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
    startOAuthFlow: vi.fn(),
  },
}));

vi.mock('../contexts/AppConfigContext', () => ({
  useAppConfig: () => ({
    oauthEnabled: false,
    partyInfoPageEnabled: false,
    isLoading: false,
  }),
}));

vi.mock('../contexts/ConsentGateContext', () => ({
  useConsentGate: () => ({
    isOpen: false,
    ensureConsents: vi.fn().mockResolvedValue('ok'),
    openWithMissing: vi.fn(),
  }),
  useConsentGateOpen: () => false,
}));

vi.mock('@cherryplay/components', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@cherryplay/components')>();
  return {
    ...actual,
    AuthForm: ({ title }: { title?: string }) =>
      createElement('div', { 'data-testid': 'auth-form' }, createElement('h2', null, title)),
  };
});

const LocationStateProbe = () => {
  const location = useLocation();
  return createElement('div', {
    'data-testid': 'location-state',
    'data-has-state': location.state == null ? 'null' : 'set',
  });
};

function renderLoginWithState(state: { accountDeleted?: boolean; passwordChanged?: boolean }) {
  return render(
    createElement(
      MemoryRouter,
      { initialEntries: [{ pathname: '/login', state }] },
      createElement(
        Routes,
        null,
        createElement(Route, {
          path: '/login',
          element: createElement(
            'div',
            null,
            createElement(LoginPage),
            createElement(LocationStateProbe),
          ),
        }),
      ),
    ),
  );
}

describe('LoginPage accountDeleted notice', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
    sessionStorage.clear();
  });

  it('shows accountDeleted status banner and clears history state', async () => {
    renderLoginWithState({ accountDeleted: true });

    const notice = await screen.findByRole('status');
    expect(notice.textContent).toContain(
      'Аккаунт удалён. Вход с прежними данными больше невозможен.',
    );
    expect(notice.getAttribute('aria-live')).toBe('polite');
    expect(screen.getByTestId('auth-form')).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByTestId('location-state').getAttribute('data-has-state')).toBe('null');
    });
  });

  it('does not show accountDeleted notice without state', async () => {
    render(
      createElement(
        MemoryRouter,
        { initialEntries: ['/login'] },
        createElement(
          Routes,
          null,
          createElement(Route, { path: '/login', element: createElement(LoginPage) }),
        ),
      ),
    );

    expect(await screen.findByTestId('auth-form')).toBeTruthy();
    expect(
      screen.queryByText('Аккаунт удалён. Вход с прежними данными больше невозможен.'),
    ).toBeNull();
  });
});
