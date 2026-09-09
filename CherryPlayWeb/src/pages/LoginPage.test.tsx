/**
 * @vitest-environment jsdom
 */
import { AuthHttpError } from '@cherryplay/components';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LoginPage } from './LoginPage';

const checkAuthMock = vi.fn();
const issueDesktopAuthCodeMock = vi.fn();

vi.mock('../services/authService', () => ({
  authService: {
    checkAuth: (...args: unknown[]) => checkAuthMock(...args),
    issueDesktopAuthCode: (...args: unknown[]) => issueDesktopAuthCodeMock(...args),
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

const ensureConsentsMock = vi.fn();

vi.mock('../contexts/ConsentGateContext', () => ({
  useConsentGate: () => ({
    isOpen: false,
    ensureConsents: (...args: unknown[]) => ensureConsentsMock(...args),
    openWithMissing: vi.fn(),
  }),
  useConsentGateOpen: () => false,
}));

vi.mock('@cherryplay/components', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@cherryplay/components')>();
  return {
    ...actual,
    AuthForm: ({
      title,
      onDesktopAuthSuccess,
    }: {
      title?: string;
      onDesktopAuthSuccess?: (code: string) => void;
    }) =>
      createElement(
        'div',
        { 'data-testid': 'auth-form' },
        createElement('h2', null, title),
        createElement(
          'button',
          {
            type: 'button',
            onClick: () => onDesktopAuthSuccess?.('form-success-code'),
          },
          'trigger-desktop-success',
        ),
      ),
    FormButton: ({
      children,
      onClick,
      disabled,
      className,
    }: {
      children?: ReactNode;
      onClick?: () => void;
      disabled?: boolean;
      className?: string;
      type?: string;
      fullWidth?: boolean;
      variant?: string;
      loading?: boolean;
    }) =>
      createElement(
        'button',
        {
          type: 'button',
          onClick,
          disabled,
          className,
        },
        children,
      ),
  };
});

function renderLogin(path: string) {
  return render(
    createElement(
      MemoryRouter,
      { initialEntries: [path] },
      createElement(
        Routes,
        null,
        createElement(Route, { path: '/login', element: createElement(LoginPage) }),
      ),
    ),
  );
}

describe('LoginPage desktop SSO', () => {
  beforeEach(() => {
    checkAuthMock.mockReset();
    issueDesktopAuthCodeMock.mockReset();
    ensureConsentsMock.mockReset();
    ensureConsentsMock.mockResolvedValue('ok');
    sessionStorage.clear();
    vi.useRealTimers();
  });

  afterEach(() => {
    cleanup();
    sessionStorage.clear();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('shows form only for non-desktop', async () => {
    renderLogin('/login');

    expect(await screen.findByTestId('auth-form')).toBeTruthy();
    expect(screen.queryByText('Проверяем сессию…')).toBeNull();
    expect(screen.queryByText('Возвращаемся в приложение…')).toBeNull();
  });

  it('shows returningToApp notice when desktop and code in URL', async () => {
    const assign = vi.fn();
    vi.stubGlobal('location', {
      ...window.location,
      assign,
    });

    renderLogin('/login?client=desktop&code=url-code-1');

    expect(await screen.findByText('Возвращаемся в приложение…')).toBeTruthy();
    const fallback = screen.getByRole('link', {
      name: 'нажмите здесь, чтобы вернуться в CherryPlayList',
    });
    expect(fallback.getAttribute('href')).toContain('code=url-code-1');
    expect(screen.queryByTestId('auth-form')).toBeNull();
  });

  it('checks session then shows continue UI when checkAuth succeeds', async () => {
    let resolveAuth: (value: { id: string; name: string; createdAt: string }) => void = () => {};
    checkAuthMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveAuth = resolve;
        }),
    );

    renderLogin('/login?client=desktop');

    expect(await screen.findByText('Проверяем сессию…')).toBeTruthy();

    await act(async () => {
      resolveAuth({ id: '1', name: 'Org', createdAt: '2020-01-01' });
    });

    expect(await screen.findByRole('button', { name: 'Войти' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Войти другим аккаунтом' })).toBeTruthy();
    expect(screen.queryByTestId('auth-form')).toBeNull();
    expect(screen.getByRole('navigation', { name: 'Юридические документы' })).toBeTruthy();
  });

  it('falls back to form when checkAuth returns null', async () => {
    checkAuthMock.mockResolvedValue(null);

    renderLogin('/login?client=desktop');

    expect(await screen.findByTestId('auth-form')).toBeTruthy();
  });

  it('falls back to form when checkAuth throws', async () => {
    checkAuthMock.mockRejectedValue(new Error('network'));

    renderLogin('/login?client=desktop');

    expect(await screen.findByTestId('auth-form')).toBeTruthy();
  });

  it('falls back to form when checkAuth hangs past probe timeout', async () => {
    vi.useFakeTimers();
    checkAuthMock.mockImplementation(() => new Promise(() => {}));

    renderLogin('/login?client=desktop');

    expect(screen.getByText('Проверяем сессию…')).toBeTruthy();
    expect(screen.queryByTestId('auth-form')).toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });

    expect(screen.getByTestId('auth-form')).toBeTruthy();
    expect(screen.queryByText('Проверяем сессию…')).toBeNull();
  });

  it('issues desktop code from session continue and shows return notice', async () => {
    checkAuthMock.mockResolvedValue({ id: '1', name: 'Org', createdAt: '2020-01-01' });
    issueDesktopAuthCodeMock.mockResolvedValue('issued-code');
    const assign = vi.fn();
    vi.stubGlobal('location', {
      ...window.location,
      assign,
    });

    renderLogin('/login?client=desktop');

    const continueButton = await screen.findByRole('button', { name: 'Войти' });
    fireEvent.click(continueButton);

    expect(await screen.findByText('Возвращаемся в приложение…')).toBeTruthy();
    expect(issueDesktopAuthCodeMock).toHaveBeenCalledTimes(1);
    const fallback = screen.getByRole('link', {
      name: 'нажмите здесь, чтобы вернуться в CherryPlayList',
    });
    expect(fallback.getAttribute('href')).toContain('code=issued-code');
  });

  it('shows error and form when issueDesktopAuthCode fails', async () => {
    checkAuthMock.mockResolvedValue({ id: '1', name: 'Org', createdAt: '2020-01-01' });
    issueDesktopAuthCodeMock.mockRejectedValue(new AuthHttpError(401, 'Нет сессии'));

    renderLogin('/login?client=desktop');

    fireEvent.click(await screen.findByRole('button', { name: 'Войти' }));

    expect((await screen.findByRole('alert')).textContent).toContain('Нет сессии');
    expect(screen.getByTestId('auth-form')).toBeTruthy();
  });

  it('switches to form when choosing another account', async () => {
    checkAuthMock.mockResolvedValue({ id: '1', name: 'Org', createdAt: '2020-01-01' });

    renderLogin('/login?client=desktop');

    fireEvent.click(await screen.findByRole('button', { name: 'Войти другим аккаунтом' }));

    expect(await screen.findByTestId('auth-form')).toBeTruthy();
  });

  it('returns to app when AuthForm calls onDesktopAuthSuccess', async () => {
    checkAuthMock.mockResolvedValue(null);
    const assign = vi.fn();
    vi.stubGlobal('location', {
      ...window.location,
      assign,
    });

    renderLogin('/login?client=desktop');

    fireEvent.click(await screen.findByRole('button', { name: 'trigger-desktop-success' }));

    expect(await screen.findByText('Возвращаемся в приложение…')).toBeTruthy();
    expect(ensureConsentsMock).toHaveBeenCalledTimes(1);
    const fallback = screen.getByRole('link', {
      name: 'нажмите здесь, чтобы вернуться в CherryPlayList',
    });
    expect(fallback.getAttribute('href')).toContain('code=form-success-code');
  });

  it('does not return to app until ensureConsents resolves ok', async () => {
    checkAuthMock.mockResolvedValue(null);
    let resolveConsents!: (value: 'ok' | 'logout' | 'error') => void;
    ensureConsentsMock.mockImplementation(
      () =>
        new Promise<'ok' | 'logout' | 'error'>((resolve) => {
          resolveConsents = resolve;
        }),
    );

    renderLogin('/login?client=desktop');

    fireEvent.click(await screen.findByRole('button', { name: 'trigger-desktop-success' }));

    expect(screen.queryByText('Возвращаемся в приложение…')).toBeNull();
    expect(screen.getByTestId('auth-form')).toBeTruthy();

    await act(async () => {
      resolveConsents('ok');
    });

    expect(await screen.findByText('Возвращаемся в приложение…')).toBeTruthy();
  });

  it('stays on login when ensureConsents returns logout', async () => {
    checkAuthMock.mockResolvedValue(null);
    ensureConsentsMock.mockResolvedValue('logout');

    renderLogin('/login?client=desktop');

    fireEvent.click(await screen.findByRole('button', { name: 'trigger-desktop-success' }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.queryByText('Возвращаемся в приложение…')).toBeNull();
    expect(screen.getByTestId('auth-form')).toBeTruthy();
  });

  it('shows error when ensureConsents returns error after desktop form success', async () => {
    checkAuthMock.mockResolvedValue(null);
    ensureConsentsMock.mockResolvedValue('error');

    renderLogin('/login?client=desktop');

    fireEvent.click(await screen.findByRole('button', { name: 'trigger-desktop-success' }));

    expect(
      await screen.findByText(
        'Не удалось подтвердить согласия. Обновите страницу или войдите снова.',
      ),
    ).toBeTruthy();
    expect(screen.queryByText('Возвращаемся в приложение…')).toBeNull();
    expect(screen.getByTestId('auth-form')).toBeTruthy();
  });

  it('runs ensureConsents before issuing desktop code on session continue', async () => {
    checkAuthMock.mockResolvedValue({ id: '1', name: 'Org', createdAt: '2020-01-01' });
    issueDesktopAuthCodeMock.mockResolvedValue('session-continue-code');
    const assign = vi.fn();
    vi.stubGlobal('location', {
      ...window.location,
      assign,
    });

    renderLogin('/login?client=desktop');

    fireEvent.click(await screen.findByRole('button', { name: 'Войти' }));

    expect(await screen.findByText('Возвращаемся в приложение…')).toBeTruthy();
    expect(ensureConsentsMock).toHaveBeenCalledTimes(1);
    expect(issueDesktopAuthCodeMock).toHaveBeenCalledTimes(1);
  });
});
