const mockGetThemeAccess = jest.fn();
const mockCheckServerReachable = jest.fn();

const partyStoreState = {
  themeAccess: null as null | {
    grantedThemeIds: string[];
    visibleLockedThemes: unknown[];
    contactUrl: string;
  },
  themeAccessErrorMessage: null as string | null,
  isThemeAccessLoading: false,
  serverUnreachable: false,
  setThemeAccess: jest.fn((value: typeof partyStoreState.themeAccess) => {
    partyStoreState.themeAccess = value;
  }),
  setThemeAccessErrorMessage: jest.fn((value: string | null) => {
    partyStoreState.themeAccessErrorMessage = value;
  }),
  setIsThemeAccessLoading: jest.fn((value: boolean) => {
    partyStoreState.isThemeAccessLoading = value;
  }),
  setServerUnreachable: jest.fn((value: boolean) => {
    partyStoreState.serverUnreachable = value;
  }),
};

const authState = { isAuthenticated: true };
const settingsState = { enableStreaming: true };

jest.mock('../../src/shared/services/partyService', () => ({
  partyService: {
    getThemeAccess: (...args: unknown[]) => mockGetThemeAccess(...args),
    checkServerReachable: (...args: unknown[]) => mockCheckServerReachable(...args),
  },
}));

jest.mock('../../src/shared/stores', () => ({
  useAuthStore: {
    getState: () => ({
      isAuthenticated: () => authState.isAuthenticated,
    }),
  },
  useSettingsStore: {
    getState: () => ({
      enableStreaming: settingsState.enableStreaming,
    }),
  },
}));

jest.mock('../../src/shared/streaming', () => ({
  getOnlineNetworkPolicy: ({ enableStreaming }: { enableStreaming: boolean }) => ({
    networkEnabled: enableStreaming,
  }),
}));

jest.mock('../../src/workspaces/party/partyWorkspaceStore', () => ({
  usePartyWorkspaceStore: {
    getState: () => partyStoreState,
  },
}));

jest.mock('../../src/workspaces/party/partyWorkspaceUtils', () => ({
  resolveThemeAccessAfterFetchFailure: (previous: unknown) => ({
    themeAccess: previous,
    themeAccessErrorMessage: previous ? null : 'Выбор недоступен — нет связи с сервером',
  }),
}));

import {
  invalidatePartyThemeAccessLoads,
  loadPartyThemeAccess,
} from '../../src/workspaces/party/partyThemeAccessLoad';

describe('loadPartyThemeAccess', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authState.isAuthenticated = true;
    settingsState.enableStreaming = true;
    partyStoreState.themeAccess = null;
    partyStoreState.themeAccessErrorMessage = null;
    partyStoreState.isThemeAccessLoading = false;
    partyStoreState.serverUnreachable = false;
    invalidatePartyThemeAccessLoads();
  });

  it('returns skipped when session is inactive', async () => {
    authState.isAuthenticated = false;
    await expect(loadPartyThemeAccess()).resolves.toBe('skipped');
    expect(mockGetThemeAccess).not.toHaveBeenCalled();
  });

  it('returns ok when theme access loads', async () => {
    const access = {
      grantedThemeIds: ['basic'],
      visibleLockedThemes: [],
      contactUrl: '',
    };
    mockGetThemeAccess.mockResolvedValue(access);

    await expect(loadPartyThemeAccess()).resolves.toBe('ok');
    expect(partyStoreState.setThemeAccess).toHaveBeenCalledWith(access);
    expect(partyStoreState.setThemeAccessErrorMessage).toHaveBeenCalledWith(null);
  });

  it('returns unreachable when fetch fails and server health is down', async () => {
    mockGetThemeAccess.mockRejectedValue(new Error('fetch failed'));
    mockCheckServerReachable.mockResolvedValue(false);

    await expect(loadPartyThemeAccess()).resolves.toBe('unreachable');
    expect(partyStoreState.setServerUnreachable).toHaveBeenCalledWith(true);
  });

  it('returns failed when fetch fails but server is reachable', async () => {
    mockGetThemeAccess.mockRejectedValue(new Error('forbidden'));
    mockCheckServerReachable.mockResolvedValue(true);

    await expect(loadPartyThemeAccess()).resolves.toBe('failed');
    expect(partyStoreState.setServerUnreachable).not.toHaveBeenCalledWith(true);
  });

  it('returns unreachable when health check itself throws', async () => {
    mockGetThemeAccess.mockRejectedValue(new Error('fetch failed'));
    mockCheckServerReachable.mockRejectedValue(new Error('health down'));

    await expect(loadPartyThemeAccess()).resolves.toBe('unreachable');
    expect(partyStoreState.setServerUnreachable).toHaveBeenCalledWith(true);
  });
});
