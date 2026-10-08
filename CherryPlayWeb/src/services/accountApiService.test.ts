/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { apiFetch } from '../utils/apiFetch';

import { deleteOrganizerAccount } from './accountApiService';

vi.mock('../utils/apiFetch', () => ({
  apiFetch: vi.fn(),
}));

function mockResponse(status: number, body?: unknown): Response {
  const ok = status >= 200 && status < 300;
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'Error',
    json: async () => body,
    text: async () => (body === undefined ? '' : JSON.stringify(body)),
  } as Response;
}

describe('accountApiService', () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('DELETEs /api/organizer/account with credentials', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(mockResponse(204));

    await expect(deleteOrganizerAccount()).resolves.toBeUndefined();

    expect(vi.mocked(apiFetch)).toHaveBeenCalledTimes(1);
    const [url, init] = vi.mocked(apiFetch).mock.calls[0] ?? [];
    expect(String(url)).toContain('/api/organizer/account');
    expect(init?.method).toBe('DELETE');
    expect(init?.credentials).toBe('include');
  });

  it('throws ApiError when response is not ok', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(
      mockResponse(500, { detail: 'Удаление временно недоступно' }),
    );

    await expect(deleteOrganizerAccount()).rejects.toMatchObject({
      status: 500,
      message: 'Удаление временно недоступно',
    });
  });
});
