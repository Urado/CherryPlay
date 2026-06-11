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
  const originalFetch = global.fetch;

  beforeEach(() => {
    resetClientOutdatedState();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    resetClientOutdatedState();
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('adds client version headers to requests', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse(200, {}));

    await apiFetch('/api/parties', { method: 'GET' });

    expect(global.fetch).toHaveBeenCalledWith('/api/parties', {
      method: 'GET',
      headers: expect.objectContaining({
        [CLIENT_VERSION_HEADER]: CLIENT_VERSION,
        [CLIENT_APP_HEADER]: CLIENT_APP_ID,
      }),
    });
  });

  it('marks client outdated on 426 with client_outdated code', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
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
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      mockResponse(403, {
        code: 'forbidden',
      }),
    );

    await apiFetch('/api/parties');

    expect(useClientOutdatedStore.getState().isOutdated).toBe(false);
  });
});
