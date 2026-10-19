// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import { adminApiService } from './adminApiService';

type AdminApiMethod = (...args: unknown[]) => Promise<unknown>;

const getRequestUrl = (input: RequestInfo | URL | undefined): URL => {
  if (input instanceof Request) return new URL(input.url, window.location.origin);
  if (input instanceof URL) return input;
  return new URL(input ?? '', window.location.origin);
};

const parseJsonBody = (body: BodyInit | null | undefined): unknown => {
  if (typeof body !== 'string') throw new TypeError('Expected a JSON string body');
  return JSON.parse(body) as unknown;
};

const callAdminMethod = async (name: string, ...args: unknown[]): Promise<unknown> => {
  const method: unknown = Reflect.get(adminApiService, name);
  expect(typeof method).toBe('function');
  if (typeof method !== 'function') return undefined;
  return (method as AdminApiMethod).apply(adminApiService, args);
};

describe('adminApiService party request contract', () => {
  let fetchMock: Mock<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>;

  beforeEach(() => {
    fetchMock = vi.fn((_input: RequestInfo | URL, _init?: RequestInit) =>
      Promise.resolve(
        new Response(JSON.stringify({ items: [], total: 0, page: 1, pageSize: 20 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('requests all parties with filters and pagination from the admin endpoint', async () => {
    await callAdminMethod('getParties', {
      organizerId: 'organizer-1',
      query: 'Летняя',
      city: 'Казань',
      partyLifecycleState: 'ready',
      isListedInCatalog: false,
      isDeleted: true,
      page: 2,
      pageSize: 20,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [requestUrl, requestInit] = fetchMock.mock.calls[0] ?? [];
    const url = getRequestUrl(requestUrl);
    expect(url.pathname).toBe('/api/admin/parties');
    expect(url.searchParams.get('organizerId')).toBe('organizer-1');
    expect(url.searchParams.get('query')).toBe('Летняя');
    expect(url.searchParams.get('city')).toBe('Казань');
    expect(url.searchParams.get('partyLifecycleState')).toBe('ready');
    expect(url.searchParams.get('isListedInCatalog')).toBe('false');
    expect(url.searchParams.get('isDeleted')).toBe('true');
    expect(url.searchParams.get('page')).toBe('2');
    expect(url.searchParams.get('pageSize')).toBe('20');
    expect(requestInit?.method ?? 'GET').toBe('GET');
    expect(requestInit?.credentials).toBe('include');
  });

  it('sends lifecycle changes to the resource endpoint with the agreed request body', async () => {
    await callAdminMethod('setPartyLifecycle', 'party-1', 'draft');

    const [requestUrl, requestInit] = fetchMock.mock.calls[0] ?? [];
    expect(getRequestUrl(requestUrl).pathname).toBe('/api/admin/parties/party-1/lifecycle');
    expect(requestInit?.method).toBe('PATCH');
    expect(requestInit?.credentials).toBe('include');
    expect(parseJsonBody(requestInit?.body)).toEqual({ partyLifecycleState: 'draft' });
  });

  it('sends catalog visibility changes independently from lifecycle state', async () => {
    await callAdminMethod('setPartyCatalogVisibility', 'party-1', false);

    const [requestUrl, requestInit] = fetchMock.mock.calls[0] ?? [];
    expect(getRequestUrl(requestUrl).pathname).toBe('/api/admin/parties/party-1/catalog-visibility');
    expect(requestInit?.method).toBe('PATCH');
    expect(parseJsonBody(requestInit?.body)).toEqual({ isListedInCatalog: false });
  });

  it('loads party details from the administrative resource endpoint', async () => {
    await callAdminMethod('getPartyById', 'party-1');

    const [requestUrl, requestInit] = fetchMock.mock.calls[0] ?? [];
    expect(getRequestUrl(requestUrl).pathname).toBe('/api/admin/parties/party-1');
    expect(requestInit?.method).toBe('GET');
    expect(requestInit?.credentials).toBe('include');
  });

  it('resets a party session with a bodyless administrative POST', async () => {
    await callAdminMethod('resetPartySession', 'party-1');

    const [requestUrl, requestInit] = fetchMock.mock.calls[0] ?? [];
    expect(getRequestUrl(requestUrl).pathname).toBe('/api/admin/parties/party-1/session-resets');
    expect(requestInit?.method).toBe('POST');
    expect(requestInit?.credentials).toBe('include');
    expect(requestInit?.body).toBeUndefined();
  });

  it('preserves the server conflict status and code for a rejected lifecycle change', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ code: 'active_connected_session' }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(callAdminMethod('setPartyLifecycle', 'party-1', 'draft')).rejects.toMatchObject({
      status: 409,
      code: 'active_connected_session',
    });
  });
});
