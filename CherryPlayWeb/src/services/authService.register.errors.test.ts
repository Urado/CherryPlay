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

describe('authService.register 400 errors', () => {
  beforeEach(() => {
    sessionStorage.clear();
    setDesktopClientMode(false);
    vi.mocked(apiFetch).mockReset();
  });

  afterEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('maps 400 with detail to AuthHttpError without calling login', async () => {
    const consents = buildRequiredConsentInputs(() => '00000000-0000-4000-8000-000000000003');
    vi.mocked(apiFetch).mockResolvedValueOnce(
      mockJsonResponse(400, { detail: 'Consent document hash mismatch.' }),
    );

    await expect(authService.register('a@b.c', 'secret1', 'Name', consents)).rejects.toMatchObject({
      status: 400,
      message: 'Consent document hash mismatch.',
    });
    expect(vi.mocked(apiFetch)).toHaveBeenCalledTimes(1);
  });

  it('maps 400 without body to fallback consent/form message', async () => {
    const consents = buildRequiredConsentInputs(() => '00000000-0000-4000-8000-000000000004');
    vi.mocked(apiFetch).mockResolvedValueOnce({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: async () => ({}),
      text: async () => '',
    } as Response);

    await expect(authService.register('a@b.c', 'secret1', 'Name', consents)).rejects.toMatchObject({
      status: 400,
      message: 'Не удалось зарегистрироваться: проверьте согласия и данные формы',
    });
    expect(vi.mocked(apiFetch)).toHaveBeenCalledTimes(1);
  });
});
