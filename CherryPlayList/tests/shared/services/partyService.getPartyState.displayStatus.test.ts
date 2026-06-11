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

function mockPublicStateResponse(partyDisplayStatus: string) {
  const stateBody = {
    partyId: PARTY_ID,
    isSessionActive: false,
    partyDisplayStatus,
    playlist: { items: [], totalDuration: 0, totalTracks: 0 },
    serverTrackIds: [],
  };
  (global.fetch as jest.Mock).mockResolvedValue(mockFetchResponse(stateBody));
  return stateBody;
}

describe('partyService.getPartyState — partyDisplayStatus wire values', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockGetApiConfig.mockResolvedValue({
      serverUrl: 'http://localhost:5000',
      signalRUrl: 'http://localhost:5000/partyHub',
      apiUrl: API_URL,
    });

    global.fetch = jest.fn();
  });

  it("parses partyDisplayStatus 'live' from public state endpoint", async () => {
    const stateBody = mockPublicStateResponse('live');

    const result = await partyService.getPartyState(SHORT_CODE);

    expect(result).toEqual(stateBody);
    expect((result as Record<string, unknown>).partyDisplayStatus).toBe('live');
    expect(global.fetch).toHaveBeenCalledWith(
      `${API_URL}/parties/public/${SHORT_CODE}/state`,
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
        cache: 'no-cache',
      }),
    );
  });

  it("parses partyDisplayStatus 'scheduled' from public state endpoint", async () => {
    const stateBody = mockPublicStateResponse('scheduled');

    const result = await partyService.getPartyState(SHORT_CODE);

    expect(result).toEqual(stateBody);
    expect((result as Record<string, unknown>).partyDisplayStatus).toBe('scheduled');
  });

  it('passes through unknown partyDisplayStatus without client validation', async () => {
    // getPartyState returns response.json() as-is; consumers should guard with isPartyDisplayStatusId.
    const stateBody = mockPublicStateResponse('broadcasting');

    const result = await partyService.getPartyState(SHORT_CODE);

    expect(result).toEqual(stateBody);
    expect((result as Record<string, unknown>).partyDisplayStatus).toBe('broadcasting');
  });
});
