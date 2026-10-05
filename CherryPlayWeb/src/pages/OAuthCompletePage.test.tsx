/**
 * @vitest-environment jsdom
 */
import {
  LEGAL_PD_CONSENT,
  LEGAL_TERMS,
  OAUTH_PENDING_CONSENTS_STORAGE_KEY,
  stashOAuthPendingConsents,
  type ConsentInput,
} from '@cherryplay/components';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { OAuthCompletePage } from './OAuthCompletePage';

const createOAuthAccountMock = vi.fn();
const issueDesktopAuthCodeMock = vi.fn();
const ensureConsentsMock = vi.fn();

vi.mock('../services/authService', () => ({
  authService: {
    createOAuthAccount: (...args: unknown[]) => createOAuthAccountMock(...args),
    issueDesktopAuthCode: (...args: unknown[]) => issueDesktopAuthCodeMock(...args),
    checkAuth: vi.fn(),
  },
}));

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
    LegalConsentBlock: ({
      pdConsentAccepted,
      termsAccepted,
      onPdConsentChange,
      onTermsChange,
      disabled,
    }: {
      pdConsentAccepted: boolean;
      termsAccepted: boolean;
      onPdConsentChange: (v: boolean) => void;
      onTermsChange: (v: boolean) => void;
      disabled?: boolean;
    }) =>
      createElement(
        'div',
        { role: 'group', 'aria-label': 'Юридические согласия' },
        createElement('input', {
          type: 'checkbox',
          checked: termsAccepted,
          disabled,
          'aria-label': 'Я принимаю условия Пользовательского соглашения',
          onChange: (e: { target: { checked: boolean } }) => onTermsChange(e.target.checked),
        }),
        createElement('input', {
          type: 'checkbox',
          checked: pdConsentAccepted,
          disabled,
          'aria-label':
            'Я даю согласие на обработку персональных данных в соответствии с текстом согласия',
          onChange: (e: { target: { checked: boolean } }) => onPdConsentChange(e.target.checked),
        }),
      ),
    FormButton: ({
      children,
      onClick,
      disabled,
      loading,
      ...rest
    }: {
      children?: ReactNode;
      onClick?: () => void;
      disabled?: boolean;
      loading?: boolean;
      type?: string;
      fullWidth?: boolean;
      'aria-describedby'?: string;
    }) =>
      createElement(
        'button',
        {
          type: 'button',
          onClick,
          disabled: disabled || loading,
          'aria-describedby': rest['aria-describedby'],
        },
        children,
      ),
  };
});

const LocationProbe = () => {
  const location = useLocation();
  return createElement('div', {
    'data-testid': 'location',
    'data-path': location.pathname,
    'data-search': location.search,
  });
};

function renderComplete(path: string) {
  return render(
    createElement(
      MemoryRouter,
      { initialEntries: [path] },
      createElement(
        Routes,
        null,
        createElement(Route, {
          path: '/oauth/complete',
          element: createElement(
            'div',
            null,
            createElement(OAuthCompletePage),
            createElement(LocationProbe),
          ),
        }),
        createElement(Route, {
          path: '/cabinet',
          element: createElement(
            'div',
            null,
            createElement('div', null, 'cabinet'),
            createElement(LocationProbe),
          ),
        }),
        createElement(Route, { path: '/login', element: createElement('div', null, 'login') }),
      ),
    ),
  );
}

describe('OAuthCompletePage', () => {
  beforeEach(() => {
    createOAuthAccountMock.mockReset();
    issueDesktopAuthCodeMock.mockReset();
    ensureConsentsMock.mockReset();
    ensureConsentsMock.mockResolvedValue('ok');
    sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
    sessionStorage.clear();
  });

  it('shows error when code is missing', () => {
    renderComplete('/oauth/complete?provider=vk');
    expect(screen.getByRole('alert').textContent).toMatch(/код/i);
  });

  it('rejects telegram provider on complete page', () => {
    renderComplete('/oauth/complete?provider=telegram&code=abc');
    expect(screen.getByRole('alert').textContent).toMatch(/Неподдерживаемый провайдер/i);
  });

  it('auto-posts pending consents with versionId and hash, strips code, replaces to cabinet', async () => {
    const consents: ConsentInput[] = [
      {
        id: '00000000-0000-4000-8000-000000000021',
        legalDocumentVersionId: LEGAL_PD_CONSENT.versionId,
        documentHash: LEGAL_PD_CONSENT.contentHash,
        decision: 'grant',
      },
      {
        id: '00000000-0000-4000-8000-000000000022',
        legalDocumentVersionId: LEGAL_TERMS.versionId,
        documentHash: LEGAL_TERMS.contentHash,
        decision: 'grant',
      },
    ];
    stashOAuthPendingConsents(consents);
    createOAuthAccountMock.mockResolvedValue({
      id: 'org-1',
      email: 'a@b.c',
      providerSubject: 'vk:1',
      accessToken: 'tok',
    });

    renderComplete('/oauth/complete?provider=vk&code=abc');

    await waitFor(() => {
      expect(createOAuthAccountMock).toHaveBeenCalledTimes(1);
    });

    expect(createOAuthAccountMock).toHaveBeenCalledWith({
      provider: 'vk',
      code: 'abc',
      consents,
    });
    expect(sessionStorage.getItem(OAUTH_PENDING_CONSENTS_STORAGE_KEY)).toBeNull();
    expect(await screen.findByText('cabinet')).toBeTruthy();
    const loc = screen.getByTestId('location');
    expect(loc.getAttribute('data-path')).toBe('/cabinet');
    expect(loc.getAttribute('data-search') ?? '').not.toContain('code=');
  });

  it('shows recovery UI when ensureConsents is not ok and strips code from URL', async () => {
    const consents: ConsentInput[] = [
      {
        id: '00000000-0000-4000-8000-000000000031',
        legalDocumentVersionId: LEGAL_PD_CONSENT.versionId,
        documentHash: LEGAL_PD_CONSENT.contentHash,
        decision: 'grant',
      },
      {
        id: '00000000-0000-4000-8000-000000000032',
        legalDocumentVersionId: LEGAL_TERMS.versionId,
        documentHash: LEGAL_TERMS.contentHash,
        decision: 'grant',
      },
    ];
    stashOAuthPendingConsents(consents);
    createOAuthAccountMock.mockResolvedValue({
      id: 'org-3',
      email: 'c@d.e',
      providerSubject: 'vk:3',
      accessToken: 'tok3',
    });
    ensureConsentsMock.mockResolvedValue('logout');

    renderComplete('/oauth/complete?provider=vk&code=secret-code');

    await waitFor(() => {
      expect(createOAuthAccountMock).toHaveBeenCalledTimes(1);
    });

    expect(await screen.findByRole('heading', { name: 'Вход не завершён' })).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toMatch(/Сессия завершена/i);
    expect(screen.getByRole('button', { name: 'Вернуться ко входу' })).toBeTruthy();
    expect(screen.queryByText('Завершаем вход…')).toBeNull();

    const loc = screen.getByTestId('location');
    expect(loc.getAttribute('data-path')).toBe('/oauth/complete');
    expect(loc.getAttribute('data-search') ?? '').not.toContain('code=');
    expect(screen.queryByText('cabinet')).toBeNull();
  });

  it('shows LegalConsentBlock when storage empty and posts on Continue', async () => {
    createOAuthAccountMock.mockResolvedValue({
      id: 'org-2',
      email: 'b@c.d',
      providerSubject: 'mailru:1',
      accessToken: 'tok2',
    });

    renderComplete('/oauth/complete?provider=mailru&code=code-1');

    expect(await screen.findByRole('button', { name: 'Продолжить' })).toBeTruthy();
    const continueBtn = screen.getByRole('button', { name: 'Продолжить' });
    expect(continueBtn.hasAttribute('disabled')).toBe(true);

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);
    expect(continueBtn.hasAttribute('disabled')).toBe(false);

    fireEvent.click(continueBtn);

    await waitFor(() => {
      expect(createOAuthAccountMock).toHaveBeenCalledTimes(1);
    });

    const arg = createOAuthAccountMock.mock.calls[0]?.[0] as {
      provider: string;
      code: string;
      consents: ConsentInput[];
    };
    expect(arg.provider).toBe('mailru');
    expect(arg.code).toBe('code-1');
    expect(arg.consents).toHaveLength(2);
    expect(arg.consents.map((c) => c.legalDocumentVersionId).sort()).toEqual(
      [LEGAL_PD_CONSENT.versionId, LEGAL_TERMS.versionId].sort(),
    );
    expect(arg.consents.map((c) => c.documentHash).sort()).toEqual(
      [LEGAL_PD_CONSENT.contentHash, LEGAL_TERMS.contentHash].sort(),
    );
  });
});
