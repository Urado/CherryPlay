jest.mock('@shared/utils/apiErrorHandler', () => ({
  parseApiErrorPayload: jest.fn(async (response: Response) => {
    try {
      const text = await response.text();
      if (!text) return null;
      return JSON.parse(text) as unknown;
    } catch {
      return null;
    }
  }),
}));

import {
  CLIENT_APP_HEADER,
  CLIENT_APP_ID,
  CLIENT_VERSION,
  CLIENT_VERSION_HEADER,
} from '@shared/config/clientVersion';
import {
  resetClientOutdatedState,
  useClientOutdatedStore,
} from '@shared/stores/clientOutdatedStore';
import { apiFetch, CLIENT_OUTDATED_CODE, CLIENT_OUTDATED_STATUS } from '@shared/utils/apiFetch';

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
  const originalFetch = global.fetch;
  const fetchMock = jest.fn<Promise<Response>, Parameters<typeof fetch>>();

  beforeEach(() => {
    resetClientOutdatedState();
    fetchMock.mockReset();
    global.fetch = fetchMock;
  });

  afterEach(() => {
    resetClientOutdatedState();
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('adds client version headers to requests', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse(200, {}));

    await apiFetch('/api/parties', { method: 'GET' });

    const [requestUrl, request] = fetchMock.mock.calls[0];
    expect(requestUrl).toBe('/api/parties');
    expect(request?.method).toBe('GET');
    const headers = new Headers(request?.headers);
    expect(headers.get(CLIENT_VERSION_HEADER)).toBe(CLIENT_VERSION);
    expect(headers.get(CLIENT_APP_HEADER)).toBe(CLIENT_APP_ID);
  });

  it('marks client outdated on 426 with client_outdated code', async () => {
    fetchMock.mockResolvedValueOnce(
      mockResponse(CLIENT_OUTDATED_STATUS, {
        code: CLIENT_OUTDATED_CODE,
        requiredVersion: '2.0.0',
      }),
    );

    await apiFetch('/api/parties');

    expect(useClientOutdatedStore.getState().isOutdated).toBe(true);
    expect(useClientOutdatedStore.getState().requiredVersion).toBe('2.0.0');
  });

  it('does not mark client outdated for other error statuses', async () => {
    fetchMock.mockResolvedValueOnce(
      mockResponse(403, {
        code: 'forbidden',
      }),
    );

    await apiFetch('/api/parties');

    expect(useClientOutdatedStore.getState().isOutdated).toBe(false);
  });
});
