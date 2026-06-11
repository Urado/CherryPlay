import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CLIENT_APP_HEADER,
  CLIENT_APP_ID,
  CLIENT_VERSION,
  CLIENT_VERSION_HEADER,
} from '../config/clientVersion';

import { apiFetch, CLIENT_OUTDATED_CODE, CLIENT_OUTDATED_STATUS } from './apiFetch';
import {
  isClientOutdated,
  resetClientOutdatedNotifier,
  subscribeClientOutdated,
} from './clientOutdatedNotifier';

function mockResponse(status: number, body: unknown): Response {
  const text = JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === CLIENT_OUTDATED_STATUS ? 'Upgrade Required' : 'Error',
    clone: () => mockResponse(status, body),
    json: async () => body,
    text: async () => text,
  } as Response;
}

describe('apiFetch', () => {
  beforeEach(() => {
    resetClientOutdatedNotifier();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    resetClientOutdatedNotifier();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('adds client version headers to requests', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse(200, {}));

    await apiFetch('/api/parties', { method: 'GET' });

    expect(fetch).toHaveBeenCalledWith('/api/parties', {
      method: 'GET',
      headers: expect.any(Headers),
    });

    const init = vi.mocked(fetch).mock.calls[0]?.[1];
    const headers = init?.headers as Headers;
    expect(headers.get(CLIENT_VERSION_HEADER)).toBe(CLIENT_VERSION);
    expect(headers.get(CLIENT_APP_HEADER)).toBe(CLIENT_APP_ID);
  });

  it('notifies client outdated on 426 with client_outdated code', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockResponse(CLIENT_OUTDATED_STATUS, {
        code: CLIENT_OUTDATED_CODE,
        requiredVersion: '2.0.0',
      }),
    );

    const listener = vi.fn();
    const unsubscribe = subscribeClientOutdated(listener);

    await apiFetch('/api/parties');

    expect(isClientOutdated()).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
  });

  it('does not notify client outdated for other error statuses', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockResponse(403, {
        code: 'forbidden',
      }),
    );

    const listener = vi.fn();
    const unsubscribe = subscribeClientOutdated(listener);

    await apiFetch('/api/parties');

    expect(isClientOutdated()).toBe(false);
    expect(listener).not.toHaveBeenCalled();

    unsubscribe();
  });
});
