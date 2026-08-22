/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RegisterPage } from './RegisterPage';

vi.mock('../services/authService', () => ({
  authService: {
    checkAuth: vi.fn(),
    register: vi.fn(),
  },
}));

vi.mock('@cherryplay/components', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@cherryplay/components')>();
  return {
    ...actual,
    EmailAuthForm: () =>
      createElement('div', { 'data-testid': 'email-auth-form' }, 'register-form'),
  };
});

function LoginRouteProbe() {
  const location = useLocation();
  return createElement(
    'div',
    {
      'data-testid': 'login-route',
      'data-search': location.search,
      'data-pathname': location.pathname,
    },
    'login',
  );
}

function renderRegister(path: string) {
  return render(
    createElement(
      MemoryRouter,
      { initialEntries: [path] },
      createElement(
        Routes,
        null,
        createElement(Route, { path: '/register', element: createElement(RegisterPage) }),
        createElement(Route, {
          path: '/login',
          element: createElement(LoginRouteProbe),
        }),
      ),
    ),
  );
}

describe('RegisterPage desktop SSO', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
    sessionStorage.clear();
  });

  it('redirects desktop query to /login?client=desktop preserving return_to and next', async () => {
    const returnTo = 'http://localhost:5173/auth/callback';
    renderRegister(
      `/register?client=desktop&return_to=${encodeURIComponent(returnTo)}&next=%2Fcabinet`,
    );

    const login = await screen.findByTestId('login-route');
    expect(login.getAttribute('data-pathname')).toBe('/login');
    const search = login.getAttribute('data-search') ?? '';
    expect(search).toContain('client=desktop');
    expect(search).toContain(`return_to=${encodeURIComponent(returnTo)}`);
    expect(search).toContain('next=%2Fcabinet');
    expect(screen.queryByTestId('email-auth-form')).toBeNull();
  });

  it('shows register form for non-desktop', async () => {
    renderRegister('/register');

    expect(await screen.findByRole('heading', { name: 'Регистрация' })).toBeTruthy();
    expect(screen.getByTestId('email-auth-form')).toBeTruthy();
    expect(screen.queryByTestId('login-route')).toBeNull();
  });

  it('redirects case-insensitive desktop client to login', async () => {
    renderRegister('/register?client=DESKTOP');

    await waitFor(() => {
      expect(screen.getByTestId('login-route')).toBeTruthy();
    });
    expect(screen.getByTestId('login-route').getAttribute('data-search')).toContain(
      'client=desktop',
    );
  });
});
