/**
 * @vitest-environment jsdom
 */
import { buildRequiredConsentInputs, LEGAL_PD_CONSENT, LEGAL_TERMS } from '@cherryplay/components';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { apiFetch } from '../utils/apiFetch';
import { setDesktopClientMode } from '../utils/desktopClientMode';

import { authService } from './authService';

vi.mock('../utils/apiFetch', () => ({
  apiFetch: vi.fn(),
}));

function mockJsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 || status === 201 ? 'OK' : 'Error',
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

describe('authService.createOAuthAccount', () => {
  beforeEach(() => {
    sessionStorage.clear();
    setDesktopClientMode(false);
    vi.mocked(apiFetch).mockReset();
  });

  afterEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('POSTs /api/oauth/accounts with consents and credentials include', async () => {
    const consents = buildRequiredConsentInputs(() => '00000000-0000-4000-8000-000000000010');
    vi.mocked(apiFetch).mockResolvedValueOnce(
      mockJsonResponse(201, {
        id: 'org-1',
        email: 'oauth@example.com',
        providerSubject: 'vk:code',
        accessToken: 'tok',
      }),
    );

    await expect(
      authService.createOAuthAccount({
        provider: 'vk',
        code: 'auth-code',
        consents,
      }),
    ).resolves.toMatchObject({
      id: 'org-1',
      email: 'oauth@example.com',
      accessToken: 'tok',
    });

    expect(vi.mocked(apiFetch)).toHaveBeenCalledTimes(1);
    const [url, init] = vi.mocked(apiFetch).mock.calls[0]!;
    expect(String(url)).toContain('/api/oauth/accounts');
    expect(init?.credentials).toBe('include');
    const body = JSON.parse(String(init?.body)) as {
      provider: string;
      code: string;
      consents: typeof consents;
    };
    expect(body.provider).toBe('vk');
    expect(body.code).toBe('auth-code');
    expect(body.consents).toEqual(consents);
    expect(body.consents[0]?.legalDocumentVersionId).toBeTruthy();
    expect(body.consents.map((c) => c.documentHash).sort()).toEqual(
      [LEGAL_PD_CONSENT.contentHash, LEGAL_TERMS.contentHash].sort(),
    );
  });
});
