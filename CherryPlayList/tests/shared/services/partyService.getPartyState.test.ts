jest.mock('../../../src/shared/config/apiConfig', () => ({
  getApiConfig: jest.fn(),
}));

jest.mock('../../../src/shared/stores/authStore', () => ({
  useAuthStore: {
    getState: jest.fn(),
  },
}));

import { getApiConfig } from '../../../src/shared/config/apiConfig';
import { partyService } from '../../../src/shared/services/partyService';

const mockGetApiConfig = getApiConfig as jest.MockedFunction<typeof getApiConfig>;

const API_URL = 'http://localhost:5000/api';
const SHORT_CODE = 'abc123';
const PARTY_ID = '123e4567-e89b-12d3-a456-426614174000';

function mockFetchResponse(
  body: unknown,
  init: { status?: number; ok?: boolean; statusText?: string } = {},
): Response {
  const status = init.status ?? 200;
  const ok = init.ok ?? (status >= 200 && status < 300);
  const serialized = typeof body === 'string' ? body : JSON.stringify(body);

  return {
    ok,
    status,
    statusText: init.statusText ?? (ok ? 'OK' : 'Error'),
    headers: new Headers({ 'content-type': 'application/json' }),
    clone() {
      return this;
    },
    json: async () => (typeof body === 'string' ? JSON.parse(body) : body),
    text: async () => serialized,
  } as Response;
}

describe('partyService.getPartyState', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockGetApiConfig.mockResolvedValue({
      serverUrl: 'http://localhost:5000',
      signalRUrl: 'http://localhost:5000/partyHub',
      apiUrl: API_URL,
    });

    global.fetch = jest.fn();
  });

  it('parses partyDisplayStatus and session fields from public state endpoint', async () => {
    const stateBody = {
      partyId: PARTY_ID,
      isSessionActive: true,
      partyDisplayStatus: 'broadcasting',
      playlist: { items: [], totalDuration: 120, totalTracks: 3 },
      serverTrackIds: ['track-1', 'track-2'],
    };
    (global.fetch as jest.Mock).mockResolvedValue(mockFetchResponse(stateBody));

    const result = await partyService.getPartyState(SHORT_CODE);

    expect(result).toEqual(stateBody);
    expect((result as Record<string, unknown>).partyDisplayStatus).toBe('broadcasting');
    expect(global.fetch).toHaveBeenCalledWith(
      `${API_URL}/parties/public/${SHORT_CODE}/state`,
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
        cache: 'no-cache',
      }),
    );
  });

  it('returns null when public state endpoint responds with 404', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      mockFetchResponse({}, { status: 404, ok: false, statusText: 'Not Found' }),
    );

    const result = await partyService.getPartyState('missing-code');

    expect(result).toBeNull();
  });
});
