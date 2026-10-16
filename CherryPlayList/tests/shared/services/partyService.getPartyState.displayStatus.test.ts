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
const fetchMock = jest.fn<Promise<Response>, Parameters<typeof fetch>>();

const mockFetchResponse = (
  body: unknown,
  init: { status?: number; ok?: boolean; statusText?: string } = {},
): Response => {
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
    json: () => Promise.resolve(typeof body === 'string' ? (JSON.parse(body) as unknown) : body),
    text: () => Promise.resolve(serialized),
  } as Response;
};

const mockPublicStateResponse = (partyDisplayStatus: string) => {
  const stateBody = {
    partyId: PARTY_ID,
    isSessionActive: false,
    partyDisplayStatus,
    playlist: { items: [], totalDuration: 0, totalTracks: 0 },
    serverTrackIds: [],
  };
  fetchMock.mockResolvedValue(mockFetchResponse(stateBody));
  return stateBody;
};

describe('partyService.getPartyState — partyDisplayStatus wire values', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockGetApiConfig.mockResolvedValue({
      serverUrl: 'http://localhost:5000',
      signalRUrl: 'http://localhost:5000/partyHub',
      apiUrl: API_URL,
    });

    fetchMock.mockReset();
    global.fetch = fetchMock;
  });

  it("parses partyDisplayStatus 'live' from public state endpoint", async () => {
    const stateBody = mockPublicStateResponse('live');

    const result = await partyService.getPartyState(SHORT_CODE);

    expect(result).toEqual(stateBody);
    expect((result as Record<string, unknown>).partyDisplayStatus).toBe('live');
    const [requestUrl, request] = fetchMock.mock.calls[0];
    expect(requestUrl).toBe(`${API_URL}/parties/public/${SHORT_CODE}/state`);
    expect(request).toMatchObject({
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-cache',
      });
  });

  it("parses partyDisplayStatus 'scheduled' from public state endpoint", async () => {
    const stateBody = mockPublicStateResponse('scheduled');

    const result = await partyService.getPartyState(SHORT_CODE);

    expect(result).toEqual(stateBody);
    expect((result as Record<string, unknown>).partyDisplayStatus).toBe('scheduled');
  });

  it('passes through unknown partyDisplayStatus without client validation', async () => {
    const stateBody = mockPublicStateResponse('broadcasting');

    const result = await partyService.getPartyState(SHORT_CODE);

    expect(result).toEqual(stateBody);
    expect((result as Record<string, unknown>).partyDisplayStatus).toBe('broadcasting');
  });
});
