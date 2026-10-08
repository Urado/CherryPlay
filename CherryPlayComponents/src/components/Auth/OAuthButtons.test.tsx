/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  LEGAL_PD_CONSENT,
  LEGAL_TERMS,
  type ConsentInput,
} from '../../constants/legalDocuments';
import { OAUTH_PENDING_CONSENTS_STORAGE_KEY } from '../../constants/oauthPendingConsents';
import type { AuthService } from '../../types/auth';

import { OAuthButtons } from './OAuthButtons';

function createAuthService(startOAuthFlow = vi.fn()): AuthService {
  return {
    login: vi.fn(),
    register: vi.fn(),
    startOAuthFlow,
  };
}

function getButtonByName(name: RegExp): HTMLButtonElement {
  const button = screen.getByRole('button', { name });
  if (!(button instanceof HTMLButtonElement)) {
    throw new Error('Expected a button element');
  }
  return button;
}

describe('OAuthButtons consent gate', () => {
  afterEach(() => {
    cleanup();
    sessionStorage.clear();
  });

  it('disables provider buttons until both consents are checked', () => {
    render(<OAuthButtons authService={createAuthService()} providers={['vk']} />);

    const button = getButtonByName(/Войти через VK/i);
    expect(button.disabled).toBe(true);
    expect(screen.getByText('Отметьте оба согласия, чтобы продолжить')).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Юридические согласия' })).toBeTruthy();

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(2);
    fireEvent.click(checkboxes[0]);
    expect(button.disabled).toBe(true);
    fireEvent.click(checkboxes[1]);
    expect(button.disabled).toBe(false);
    expect(screen.queryByText('Отметьте оба согласия, чтобы продолжить')).toBeNull();
  });

  it('stashes buildRequiredConsentInputs in sessionStorage before startOAuthFlow', async () => {
    const startOAuthFlow = vi.fn().mockResolvedValue(undefined);
    render(
      <OAuthButtons authService={createAuthService(startOAuthFlow)} providers={['telegram']} />,
    );

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);

    fireEvent.click(screen.getByRole('button', { name: /Войти через Telegram/i }));

    await waitFor(() => {
      expect(startOAuthFlow).toHaveBeenCalledWith('telegram');
    });

    const raw = sessionStorage.getItem(OAUTH_PENDING_CONSENTS_STORAGE_KEY);
    expect(raw).toBeTruthy();
    const consents = JSON.parse(String(raw)) as ConsentInput[];
    expect(consents).toHaveLength(2);
    expect(consents.every((c) => c.decision === 'grant')).toBe(true);
    expect(consents.map((c) => c.legalDocumentVersionId).sort()).toEqual(
      [LEGAL_PD_CONSENT.versionId, LEGAL_TERMS.versionId].sort(),
    );
    expect(consents.map((c) => c.documentHash).sort()).toEqual(
      [LEGAL_PD_CONSENT.contentHash, LEGAL_TERMS.contentHash].sort(),
    );
  });
});
