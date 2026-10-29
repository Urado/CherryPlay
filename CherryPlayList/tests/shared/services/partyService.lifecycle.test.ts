jest.mock('../../../src/shared/config/apiConfig', () => ({
  getApiConfig: jest.fn(),
}));

jest.mock('../../../src/shared/stores/authStore', () => ({
  useAuthStore: {
    getState: jest.fn(),
  },
}));

import { getApiConfig } from '../../../src/shared/config/apiConfig';
import {
  InvalidPartyLifecycleTransitionError,
  partyService,
  type PartyDto,
} from '../../../src/shared/services/partyService';
import { useAuthStore } from '../../../src/shared/stores/authStore';

const mockGetApiConfig = getApiConfig as jest.MockedFunction<typeof getApiConfig>;
const mockGetAuthState = useAuthStore.getState as jest.MockedFunction<typeof useAuthStore.getState>;

const API_URL = 'http://localhost:5000/api';
const PARTY_ID = '123e4567-e89b-12d3-a456-426614174000';
const ACCESS_TOKEN = 'test-access-token';
const fetchMock = jest.fn<Promise<Response>, Parameters<typeof fetch>>();

const makePartyDto = (overrides: Partial<PartyDto> = {}): PartyDto => {
  return {
    id: PARTY_ID,
    name: 'Test Party',
    shortCode: 'abc123',
    partyThemeId: 'theme-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    hasActiveSession: false,
    partyLifecycleState: 'ready',
    ...overrides,
  };
};

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

describe('partyService.transitionPartyLifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockGetApiConfig.mockResolvedValue({
      serverUrl: 'http://localhost:5000',
      signalRUrl: 'http://localhost:5000/partyHub',
      apiUrl: API_URL,
    });

    mockGetAuthState.mockReturnValue({
      accessToken: ACCESS_TOKEN,
      organizer: { id: 'org-1', name: 'Organizer' },
      setToken: jest.fn(),
      setOrganizer: jest.fn(),
      clearAuth: jest.fn(),
      isAuthenticated: () => true,
    });

    fetchMock.mockReset();
    global.fetch = fetchMock;
  });

  it('returns PartyDto on successful lifecycle transition', async () => {
    const party = makePartyDto({ partyLifecycleState: 'ready' });
    fetchMock.mockResolvedValue(mockFetchResponse(party));

    const result = await partyService.transitionPartyLifecycle(PARTY_ID, 'ready');

    expect(result).toEqual(party);
    const [requestUrl, request] = fetchMock.mock.calls[0];
    expect(requestUrl).toBe(`${API_URL}/parties/${PARTY_ID}/lifecycle`);
    expect(request).toMatchObject({
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ partyLifecycleState: 'ready' }),
      cache: 'no-cache',
    });
  });

  it('parses 409 invalid_lifecycle_transition into InvalidPartyLifecycleTransitionError', async () => {
    fetchMock.mockResolvedValue(
      mockFetchResponse(
        {
          code: 'invalid_lifecycle_transition',
          message: 'Нельзя перевести вечеринку из «Ждёт начала» в «Черновик».',
          currentState: 'ready',
          requestedState: 'draft',
        },
        { status: 409, ok: false, statusText: 'Conflict' },
      ),
    );

    const error = partyService.transitionPartyLifecycle(PARTY_ID, 'draft');

    await expect(error).rejects.toMatchObject({
      name: 'InvalidPartyLifecycleTransitionError',
      code: 'invalid_lifecycle_transition',
      currentState: 'ready',
      requestedState: 'draft',
      message: 'Нельзя перевести вечеринку из «Ждёт начала» в «Черновик».',
    });
    await expect(error).rejects.toBeInstanceOf(InvalidPartyLifecycleTransitionError);
  });

  it('allows idempotent transition when party is already in target state', async () => {
    const party = makePartyDto({ partyLifecycleState: 'ready' });
    (global.fetch as jest.Mock).mockResolvedValue(mockFetchResponse(party));

    const result = await partyService.transitionPartyLifecycle(PARTY_ID, 'ready');

    expect(result.partyLifecycleState).toBe('ready');
    expect(global.fetch).toHaveBeenCalledWith(
      `${API_URL}/parties/${PARTY_ID}/lifecycle`,
      expect.objectContaining({
        body: JSON.stringify({ partyLifecycleState: 'ready' }),
      }),
    );
  });

  it('normalizes party id and sends draft to ready transition', async () => {
    const party = makePartyDto({ partyLifecycleState: 'ready' });
    (global.fetch as jest.Mock).mockResolvedValue(mockFetchResponse(party));

    const upperCaseId = PARTY_ID.toUpperCase();
    const result = await partyService.transitionPartyLifecycle(upperCaseId, 'ready');

    expect(result.partyLifecycleState).toBe('ready');
    expect(global.fetch).toHaveBeenCalledWith(
      `${API_URL}/parties/${PARTY_ID}/lifecycle`,
      expect.objectContaining({
        body: JSON.stringify({ partyLifecycleState: 'ready' }),
      }),
    );
  });
});
