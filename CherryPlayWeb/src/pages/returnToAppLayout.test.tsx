import {
  LEGAL_PD_CONSENT,
  LEGAL_TERMS,
  stashOAuthPendingConsents,
} from '@cherryplay/components';
import { render, screen, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LoginPage } from './LoginPage';
import { OAuthCompletePage } from './OAuthCompletePage';

const issueDesktopAuthCodeMock = vi.fn<() => Promise<string>>();
const createOAuthAccountMock = vi.fn<() => Promise<{ id: string }>>();
const ensureConsentsMock = vi.fn<() => Promise<'ok'>>();

vi.mock('../services/authService', () => ({
  authService: {
    checkAuth: vi.fn(),
    issueDesktopAuthCode: () => issueDesktopAuthCodeMock(),
    createOAuthAccount: () => createOAuthAccountMock(),
  },
}));

vi.mock('../contexts/AppConfigContext', () => ({
  useAppConfig: () => ({ oauthEnabled: false, partyInfoPageEnabled: false, isLoading: false }),
}));

vi.mock('../contexts/ConsentGateContext', () => ({
  useConsentGate: () => ({ ensureConsents: () => ensureConsentsMock() }),
  useConsentGateOpen: () => false,
}));

const renderAt = (path: string, page: ReactNode, route: string) => {
  return render(
    createElement(
      MemoryRouter,
      { initialEntries: [path] },
      createElement(
        Routes,
        null,
        createElement(Route, { path: route, element: page }),
      ),
    ),
  );
};

const expectCenteredReturnLayout = (pageClass: string, bodyClass: string) => {
  const notice = screen.getByRole('status');
  const fallback = screen.getByRole('link', {
    name: 'нажмите здесь, чтобы вернуться в CherryPashka List',
  });
  expect(notice.matches(`.${pageClass} > .${bodyClass} > [role="status"]`)).toBe(true);
  expect(
    fallback.matches(`.${pageClass} > .${bodyClass} > .${pageClass}-return-fallback a`),
  ).toBe(true);
};

describe('return-to-app layout', () => {
  beforeEach(() => {
    issueDesktopAuthCodeMock.mockReset();
    createOAuthAccountMock.mockReset();
    ensureConsentsMock.mockReset();
    issueDesktopAuthCodeMock.mockResolvedValue('desktop-code');
    createOAuthAccountMock.mockResolvedValue({ id: 'organizer-1' });
    ensureConsentsMock.mockResolvedValue('ok');
    sessionStorage.clear();
    vi.stubGlobal('location', { ...window.location, assign: vi.fn() });
  });

  afterEach(() => {
    sessionStorage.clear();
    vi.unstubAllGlobals();
  });

  it('keeps both return notices and fallback links inside their centered page bodies', async () => {
    const view = renderAt(
      '/login?client=desktop&code=desktop-code',
      createElement(LoginPage),
      '/login',
    );

    await screen.findByText('Возвращаемся в приложение…');
    expectCenteredReturnLayout('login-page', 'login-page-body');
    view.unmount();

    stashOAuthPendingConsents([
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
    ]);
    renderAt(
      '/oauth/complete?provider=vk&code=oauth-code&client=desktop',
      createElement(OAuthCompletePage),
      '/oauth/complete',
    );

    await waitFor(() => expectCenteredReturnLayout('oauth-complete-page', 'oauth-complete-page-body'));
  });
});
