import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CLIENT_APP_HEADER,
  CLIENT_APP_ID,
  CLIENT_VERSION,
  CLIENT_VERSION_HEADER,
} from '../config/clientVersion';

import {
  apiFetch,
  CLIENT_OUTDATED_CODE,
  CLIENT_OUTDATED_STATUS,
  CONSENT_REQUIRED_CODE,
} from './apiFetch';
import {
  isClientOutdated,
  resetClientOutdatedNotifier,
  subscribeClientOutdated,
} from './clientOutdatedNotifier';
import {
  isConsentGateOpen,
  resetConsentGateNotifier,
  subscribeConsentRequired,
} from './consentGateNotifier';

const mockResponse = (status: number, body: unknown): Response => {
  const text = JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === CLIENT_OUTDATED_STATUS ? 'Upgrade Required' : 'Error',
    clone: () => mockResponse(status, body),
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(text),
  } as Response;
};

describe('apiFetch', () => {
  beforeEach(() => {
    resetClientOutdatedNotifier();
    resetConsentGateNotifier();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    resetClientOutdatedNotifier();
    resetConsentGateNotifier();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('adds client version headers to requests', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse(200, {}));

    await apiFetch('/api/parties', { method: 'GET' });

    expect(vi.mocked(fetch).mock.calls[0]?.[0]).toBe('/api/parties');
    expect(vi.mocked(fetch).mock.calls[0]?.[1]?.method).toBe('GET');
    expect(vi.mocked(fetch).mock.calls[0]?.[1]?.headers).toBeInstanceOf(Headers);

    const headers = new Headers(
      (
        vi.mocked(fetch).mock.calls[0] as unknown as [RequestInfo | URL, RequestInit] | undefined
      )?.[1]?.headers,
    );
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

  it('notifies consent gate on 403 consent_required without treating as logout', async () => {
    const missing = ['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'];
    vi.mocked(fetch).mockResolvedValueOnce(
      mockResponse(403, {
        code: CONSENT_REQUIRED_CODE,
        message: 'Consent required',
        missing,
      }),
    );

    const listener = vi.fn();
    const unsubscribe = subscribeConsentRequired(listener);

    const response = await apiFetch('/api/parties', { method: 'POST' });

    expect(response.status).toBe(403);
    expect(isConsentGateOpen()).toBe(true);
    expect(listener).toHaveBeenCalledWith(missing);

    unsubscribe();
  });

  it('does not open consent gate for unrelated 403', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockResponse(403, {
        code: 'theme_not_entitled',
      }),
    );

    const listener = vi.fn();
    const unsubscribe = subscribeConsentRequired(listener);

    await apiFetch('/api/parties', { method: 'POST' });

    expect(isConsentGateOpen()).toBe(false);
    expect(listener).not.toHaveBeenCalled();

    unsubscribe();
  });
});
