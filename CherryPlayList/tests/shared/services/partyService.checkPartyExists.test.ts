jest.mock('../../../src/shared/config/apiConfig', () => ({
  getApiConfig: jest.fn(),
}));

jest.mock('../../../src/shared/stores/authStore', () => ({
  useAuthStore: {
    getState: jest.fn(),
  },
}));

jest.mock('../../../src/shared/demo/guardDemoAuth', () => ({
  isDemoAuthMode: jest.fn(() => false),
}));

jest.mock('../../../src/shared/demo/demoPartyFixture', () => ({
  DEMO_PARTY_ID: '00000000-0000-4000-8000-000000000099',
  DEMO_THEME_ACCESS: { grantedThemeIds: [], visibleLockedThemes: [], contactUrl: '' },
  demoCreateParty: jest.fn(),
  demoTransitionPartyLifecycle: jest.fn(),
  demoUpdateParty: jest.fn(),
  getDemoPartyPublicUrl: jest.fn(),
  getDemoPartySnapshot: jest.fn(),
  getDemoPartyState: jest.fn(),
}));

import { getApiConfig } from '../../../src/shared/config/apiConfig';
import { partyService } from '../../../src/shared/services/partyService';
import { useAuthStore } from '../../../src/shared/stores/authStore';

const mockGetApiConfig = getApiConfig as jest.MockedFunction<typeof getApiConfig>;
const mockGetAuthState = useAuthStore.getState as jest.MockedFunction<typeof useAuthStore.getState>;

const API_URL = 'http://localhost:5000/api';
const PARTY_ID = '123e4567-e89b-12d3-a456-426614174000';
const ACCESS_TOKEN = 'test-access-token';

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

describe('partyService.checkPartyExists', () => {
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

    global.fetch = jest.fn();
  });

  it('returns true when party GET succeeds', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      mockFetchResponse({ id: PARTY_ID, name: 'Party' }),
    );

    await expect(partyService.checkPartyExists(PARTY_ID)).resolves.toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      `${API_URL}/parties/${PARTY_ID}`,
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('returns false only when party GET responds with 404', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      mockFetchResponse({}, { status: 404, ok: false, statusText: 'Not Found' }),
    );

    await expect(partyService.checkPartyExists(PARTY_ID)).resolves.toBe(false);
  });

  it('throws on network failure instead of returning false', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Failed to fetch'));

    await expect(partyService.checkPartyExists(PARTY_ID)).rejects.toThrow('Failed to fetch');
  });

  it('throws on HTTP 500 instead of returning false', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      mockFetchResponse({ message: 'boom' }, { status: 500, ok: false, statusText: 'Error' }),
    );

    await expect(partyService.checkPartyExists(PARTY_ID)).rejects.toThrow();
  });
});
