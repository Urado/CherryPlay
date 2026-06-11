const mockOn = jest.fn();
const mockOff = jest.fn();
const mockInvoke = jest.fn().mockResolvedValue(undefined);
const mockStart = jest.fn().mockResolvedValue(undefined);
const mockConnection = {
  on: mockOn,
  off: mockOff,
  start: mockStart,
  stop: jest.fn().mockResolvedValue(undefined),
  invoke: mockInvoke,
  onclose: jest.fn(),
  onreconnecting: jest.fn(),
  onreconnected: jest.fn(),
  state: 'Connected',
};

jest.mock('@microsoft/signalr', () => ({
  HubConnectionBuilder: jest.fn().mockImplementation(() => ({
    withUrl: jest.fn().mockReturnThis(),
    withAutomaticReconnect: jest.fn().mockReturnThis(),
    build: jest.fn().mockReturnValue(mockConnection),
  })),
  HubConnectionState: {
    Connected: 'Connected',
    Disconnected: 'Disconnected',
    Reconnecting: 'Reconnecting',
    Disconnecting: 'Disconnecting',
  },
}));

jest.mock('../../../src/shared/config/apiConfig', () => ({
  getApiConfig: jest.fn().mockResolvedValue({
    serverUrl: 'http://localhost:5000',
    signalRUrl: 'http://localhost:5000/partyHub',
    apiUrl: 'http://localhost:5000/api',
  }),
  clearApiConfigCache: jest.fn(),
}));

jest.mock('../../../src/shared/stores', () => ({
  useAuthStore: {
    getState: jest.fn().mockReturnValue({
      accessToken: 'valid-token',
    }),
    subscribe: jest.fn(),
  },
  usePlayerAudioStore: {
    getState: jest.fn().mockReturnValue({
      currentTrackId: null,
      status: 'idle',
      position: 0,
      duration: 0,
      volume: 0.8,
    }),
    subscribe: jest.fn(),
  },
  useProjectStore: {
    getState: jest.fn().mockReturnValue({
      linkedParty: { id: 'party-1' },
      playlist: { items: [] },
    }),
    subscribe: jest.fn(),
  },
}));

jest.mock('../../../src/shared/utils/authErrorHandler', () => ({
  handleAuthError: jest.fn(),
  isAuthError: jest.fn().mockReturnValue(false),
}));

jest.mock('../../../src/shared/utils/tokenUtils', () => ({
  isTokenExpired: jest.fn().mockReturnValue(false),
}));

jest.mock('../../../src/shared/utils/partyUtils', () => ({
  convertPlaylistForApi: jest.fn(),
}));

jest.mock('../../../src/shared/services/partyService', () => ({
  partyService: {},
}));

function getHandler(eventName: string): ((...args: unknown[]) => void) | undefined {
  return mockOn.mock.calls.find(([name]) => name === eventName)?.[1];
}

describe('CherryPlayList signalRService events and invoke', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    mockConnection.state = 'Connected';
    jest.resetModules();
    const { clearApiConfigCache } = await import('../../../src/shared/config/apiConfig');
    clearApiConfigCache();
  });

  it('registers OnSessionStarted handler after connect', async () => {
    const { signalRService } = await import('../../../src/shared/services/signalRService');
    const handler = jest.fn();

    signalRService.onSessionStarted(handler);
    await signalRService.connect('valid-token');

    expect(mockOn).toHaveBeenCalledWith('OnSessionStarted', expect.any(Function));
    getHandler('OnSessionStarted')?.('party-1');
    expect(handler).toHaveBeenCalledWith('party-1');
  });

  it('registers OnFullStateUpdated handler after connect', async () => {
    const { signalRService } = await import('../../../src/shared/services/signalRService');
    const handler = jest.fn();
    const state = {
      currentTrackId: 'track-1',
      status: 'playing' as const,
      position: 0,
      duration: 120,
      volume: 0.8,
      mode: 'session' as const,
      playedTrackIds: [],
      disabledTrackIds: [],
      disabledGroupIds: [],
      lastUpdatedAt: '2026-01-01T00:00:00.000Z',
    };

    signalRService.onFullStateUpdated(handler);
    await signalRService.connect('valid-token');

    getHandler('OnFullStateUpdated')?.('party-2', state);
    expect(handler).toHaveBeenCalledWith('party-2', state);
  });

  it('startSession invokes StartSession hub method', async () => {
    const { signalRService } = await import('../../../src/shared/services/signalRService');
    await signalRService.connect('valid-token');

    await signalRService.startSession('party-3');

    expect(mockInvoke).toHaveBeenCalledWith('StartSession', 'party-3');
  });

  it('endSession invokes EndSession hub method', async () => {
    const { signalRService } = await import('../../../src/shared/services/signalRService');
    await signalRService.connect('valid-token');

    await signalRService.endSession('party-4');

    expect(mockInvoke).toHaveBeenCalledWith('EndSession', 'party-4');
  });

  it('resetPlaybackState invokes ResetPlaybackState hub method', async () => {
    const { signalRService } = await import('../../../src/shared/services/signalRService');
    await signalRService.connect('valid-token');

    await signalRService.resetPlaybackState('party-5');

    expect(mockInvoke).toHaveBeenCalledWith('ResetPlaybackState', 'party-5');
  });

  it('joinPartyAsOrganizer invokes JoinPartyAsOrganizer with token', async () => {
    const { signalRService } = await import('../../../src/shared/services/signalRService');
    await signalRService.connect('valid-token');

    await signalRService.joinPartyAsOrganizer('party-6', 'valid-token');

    expect(mockInvoke).toHaveBeenCalledWith('JoinPartyAsOrganizer', 'party-6', 'valid-token');
  });
});
