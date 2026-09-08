/**
 * @vitest-environment jsdom
 */
import { buildRequiredConsentInputs } from '@cherryplay/components';
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

describe('authService register with consents', () => {
  beforeEach(() => {
    sessionStorage.clear();
    setDesktopClientMode(false);
    vi.mocked(apiFetch).mockReset();
  });

  afterEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('POSTs /api/organizers then /auth/login', async () => {
    const consents = buildRequiredConsentInputs(() => '00000000-0000-4000-8000-000000000001');
    vi.mocked(apiFetch)
      .mockResolvedValueOnce(
        mockJsonResponse(201, { id: 'org-1', email: 'a@b.c', name: 'Name' }),
      )
      .mockResolvedValueOnce(mockJsonResponse(200, { accessToken: 'tok' }));

    await expect(authService.register('a@b.c', 'secret1', 'Name', consents)).resolves.toBeUndefined();

    expect(vi.mocked(apiFetch).mock.calls).toHaveLength(2);
    expect(String(vi.mocked(apiFetch).mock.calls[0]?.[0])).toContain('/api/organizers');
    const createBody = JSON.parse(String(vi.mocked(apiFetch).mock.calls[0]?.[1]?.body));
    expect(createBody.consents).toEqual(consents);
    expect(String(vi.mocked(apiFetch).mock.calls[1]?.[0])).toContain('/auth/login');
  });

  it('maps email-conflict 409 to RU message without calling login', async () => {
    const consents = buildRequiredConsentInputs(() => '00000000-0000-4000-8000-000000000002');
    vi.mocked(apiFetch).mockResolvedValueOnce(
      mockJsonResponse(409, { detail: 'Email is already registered.' }),
    );

    await expect(authService.register('a@b.c', 'secret1', 'Name', consents)).rejects.toMatchObject({
      status: 409,
      message: 'Этот email уже зарегистрирован',
    });
    expect(vi.mocked(apiFetch)).toHaveBeenCalledTimes(1);
  });

  it('passes through non-email 409 detail from ProblemDetails', async () => {
    const consents = buildRequiredConsentInputs(() => '00000000-0000-4000-8000-000000000003');
    vi.mocked(apiFetch).mockResolvedValueOnce(
      mockJsonResponse(409, { detail: 'Consent version conflict.' }),
    );

    await expect(authService.register('a@b.c', 'secret1', 'Name', consents)).rejects.toMatchObject({
      status: 409,
      message: 'Consent version conflict.',
    });
    expect(vi.mocked(apiFetch)).toHaveBeenCalledTimes(1);
  });

  it('falls back to RU email message when 409 detail is empty', async () => {
    const consents = buildRequiredConsentInputs(() => '00000000-0000-4000-8000-000000000004');
    vi.mocked(apiFetch).mockResolvedValueOnce({
      ok: false,
      status: 409,
      statusText: 'Error',
      json: async () => ({}),
      text: async () => '',
    } as Response);

    await expect(authService.register('a@b.c', 'secret1', 'Name', consents)).rejects.toMatchObject({
      status: 409,
      message: 'Этот email уже зарегистрирован',
    });
  });
});
