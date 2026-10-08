/**
 * @vitest-environment jsdom
 */
import { LEGAL_PD_CONSENT, LEGAL_TERMS } from '@cherryplay/components';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CabinetPage } from './CabinetPage';

const checkAuthMock = vi.fn();
const logoutMock = vi.fn();
const deleteOrganizerAccountMock = vi.fn();
const listConsentEventsMock = vi.fn();
const createConsentEventsMock = vi.fn();
const getMyPartiesMock = vi.fn();
const ensureConsentsMock = vi.fn();

vi.mock('../services/authService', () => ({
  authService: {
    checkAuth: (...args: unknown[]) => checkAuthMock(...args),
    logout: (...args: unknown[]) => logoutMock(...args),
  },
}));

vi.mock('../services/accountApiService', () => ({
  deleteOrganizerAccount: (...args: unknown[]) => deleteOrganizerAccountMock(...args),
}));

vi.mock('../services/consentEventsService', async () => {
  const actual = await vi.importActual<typeof import('../services/consentEventsService')>(
    '../services/consentEventsService',
  );
  return {
    ...actual,
    listConsentEvents: (...args: unknown[]) => listConsentEventsMock(...args),
    createConsentEvents: (...args: unknown[]) => createConsentEventsMock(...args),
  };
});

vi.mock('../services/partyApiService', () => ({
  partyApiService: {
    getMyParties: (...args: unknown[]) => getMyPartiesMock(...args),
  },
}));

vi.mock('../contexts/ConsentGateContext', () => ({
  useConsentGate: () => ({
    isOpen: false,
    ensureConsents: ensureConsentsMock,
    openWithMissing: vi.fn(),
  }),
}));

vi.mock('../hooks/useThemeAccess', () => ({
  useThemeAccess: () => ({ data: null, error: null }),
  clearThemeAccessCache: vi.fn(),
}));

vi.mock('@cherryplay/components', async (importOriginal) => {
  const React = await import('react');
  const actual = await importOriginal<typeof import('@cherryplay/components')>();
  return {
    ...actual,
    ChangePasswordForm: () => React.createElement('div', { 'data-testid': 'change-password-form' }),
    Button: React.forwardRef<
      HTMLButtonElement,
      {
        children?: React.ReactNode;
        onClick?: () => void;
        disabled?: boolean;
        loading?: boolean;
        type?: string;
        variant?: string;
        size?: string;
        className?: string;
        'aria-describedby'?: string;
        'aria-label'?: string;
      }
    >(({ children, onClick, disabled, loading, ...rest }, ref) => {
      return React.createElement(
        'button',
        {
          type: 'button',
          onClick,
          disabled: disabled || loading,
          ref,
          ...rest,
        },
        children,
      );
    }),
  };
});

const LoginProbe = () => {
  const location = useLocation();
  const state = location.state as { accountDeleted?: boolean } | null;
  return createElement('div', {
    'data-testid': 'login-probe',
    'data-account-deleted': state?.accountDeleted === true ? 'true' : 'false',
  });
};

function ensureAppRoot(): HTMLElement {
  let root = document.getElementById('root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'root';
    document.body.appendChild(root);
  }
  return root;
}

function renderCabinet(path = '/cabinet#account') {
  const root = ensureAppRoot();
  return render(
    createElement(
      MemoryRouter,
      { initialEntries: [path] },
      createElement(
        Routes,
        null,
        createElement(Route, { path: '/cabinet', element: createElement(CabinetPage) }),
        createElement(Route, { path: '/login', element: createElement(LoginProbe) }),
      ),
    ),
    { container: root },
  );
}

describe('CabinetPage account deletion / privacy UX', () => {
  beforeEach(() => {
    checkAuthMock.mockReset();
    logoutMock.mockReset();
    deleteOrganizerAccountMock.mockReset();
    listConsentEventsMock.mockReset();
    createConsentEventsMock.mockReset();
    getMyPartiesMock.mockReset();
    ensureConsentsMock.mockReset();

    checkAuthMock.mockResolvedValue({
      id: 'org-1',
      name: 'Org',
      createdAt: '2024-01-01T00:00:00Z',
      logoUrl: null,
    });
    ensureConsentsMock.mockResolvedValue('ok');
    getMyPartiesMock.mockResolvedValue([]);
    listConsentEventsMock.mockResolvedValue([
      {
        id: 'e1',
        legalDocumentVersionId: LEGAL_PD_CONSENT.versionId,
        documentHash: LEGAL_PD_CONSENT.contentHash,
        decision: 'grant',
        eventAt: '2026-09-01T00:00:00Z',
      },
      {
        id: 'e2',
        legalDocumentVersionId: LEGAL_TERMS.versionId,
        documentHash: LEGAL_TERMS.contentHash,
        decision: 'withdraw',
        eventAt: '2026-09-01T00:00:00Z',
      },
    ]);
    logoutMock.mockResolvedValue(undefined);
    deleteOrganizerAccountMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
  });

  it('maps consent decisions to Russian labels and mailto privacy contact', async () => {
    renderCabinet();

    expect(await screen.findByText(/принято/)).toBeTruthy();
    expect(screen.getByText(/отозвано/)).toBeTruthy();

    const mailLink = screen.getByRole('link', { name: /@/ });
    expect(mailLink.getAttribute('href')?.startsWith('mailto:')).toBe(true);
  });

  it('opens alertdialog for delete and navigates with accountDeleted on confirm', async () => {
    renderCabinet();

    const deleteButton = await screen.findByRole('button', { name: 'Удалить аккаунт' });
    expect(deleteButton.getAttribute('aria-describedby')).toBeTruthy();

    fireEvent.click(deleteButton);

    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toBeTruthy();
    expect(screen.getByText('Удалить аккаунт?')).toBeTruthy();
    expect(screen.getByRole('status', { hidden: true }).textContent).toContain('необратимо');

    fireEvent.click(screen.getByRole('button', { name: 'Удалить навсегда' }));

    await waitFor(() => {
      expect(deleteOrganizerAccountMock).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(screen.getByTestId('login-probe').getAttribute('data-account-deleted')).toBe('true');
    });
  });

  it('focuses cancel, marks #root inert, Esc cancels and restores focus', async () => {
    renderCabinet();

    const deleteButton = await screen.findByRole('button', { name: 'Удалить аккаунт' });
    deleteButton.focus();
    fireEvent.click(deleteButton);

    const dialog = await screen.findByRole('alertdialog');
    const cancelButton = screen.getByRole('button', { name: 'Отмена' });
    expect(document.activeElement).toBe(cancelButton);

    const root = document.getElementById('root');
    expect(root?.hasAttribute('inert')).toBe(true);
    expect(root?.getAttribute('aria-hidden')).toBe('true');

    fireEvent.mouseDown(dialog);
    expect(screen.getByRole('alertdialog')).toBeTruthy();

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).toBeNull();
    });
    expect(root?.hasAttribute('inert')).toBe(false);
    expect(root?.hasAttribute('aria-hidden')).toBe(false);
    expect(document.activeElement).toBe(deleteButton);
  });

  it('requires confirm dialog before withdrawing consents', async () => {
    createConsentEventsMock.mockResolvedValue(undefined);
    renderCabinet();

    fireEvent.click(await screen.findByRole('button', { name: 'Отозвать активные согласия' }));

    expect(await screen.findByRole('alertdialog')).toBeTruthy();
    expect(screen.getByText('Отозвать согласия?')).toBeTruthy();
    expect(createConsentEventsMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Отозвать' }));

    await waitFor(() => {
      expect(createConsentEventsMock).toHaveBeenCalledTimes(1);
    });
    const payload = createConsentEventsMock.mock.calls[0]?.[0] as Array<{ decision: string }>;
    expect(payload.every((item) => item.decision === 'withdraw')).toBe(true);
    expect(payload).toHaveLength(1);
  });

  it('surfaces privacyError with role=alert on delete failure', async () => {
    deleteOrganizerAccountMock.mockRejectedValueOnce({
      message: 'Сервер недоступен',
      status: 503,
      statusText: 'Unavailable',
    });
    renderCabinet();

    fireEvent.click(await screen.findByRole('button', { name: 'Удалить аккаунт' }));
    expect(await screen.findByRole('alertdialog')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Удалить навсегда' }));

    await waitFor(() => {
      expect(deleteOrganizerAccountMock).toHaveBeenCalledTimes(1);
    });
    expect((await screen.findByRole('alert')).textContent).toContain('Сервер недоступен');
  });
});
