import * as signalR from '@microsoft/signalr';

const mockCheckPartyExists = jest.fn();
const mockSetPartyReconnectHandler = jest.fn();
const mockOnReconnectionFailed = jest.fn();
const mockIsServiceConnected = jest.fn();
const mockConnect = jest.fn();
const mockJoinPartyAsOrganizer = jest.fn();
const mockDisconnect = jest.fn();
const mockEndSession = jest.fn();
const mockResetPlaybackState = jest.fn();

jest.mock('../../../src/shared/services/partyService', () => ({
  partyService: {
    checkPartyExists: (...args: unknown[]) => mockCheckPartyExists(...args),
  },
}));

jest.mock('../../../src/shared/services/signalRService', () => ({
  signalRService: {
    setPartyReconnectHandler: (...args: unknown[]) => mockSetPartyReconnectHandler(...args),
    onReconnectionFailed: (...args: unknown[]) => mockOnReconnectionFailed(...args),
    isServiceConnected: (...args: unknown[]) => mockIsServiceConnected(...args),
    connect: (...args: unknown[]) => mockConnect(...args),
    joinPartyAsOrganizer: (...args: unknown[]) => mockJoinPartyAsOrganizer(...args),
    disconnect: (...args: unknown[]) => mockDisconnect(...args),
    endSession: (...args: unknown[]) => mockEndSession(...args),
    resetPlaybackState: (...args: unknown[]) => mockResetPlaybackState(...args),
    notifyStateChangedOrThrow: jest.fn().mockResolvedValue(undefined),
    updateFullStateOrThrow: jest.fn().mockResolvedValue(undefined),
    startSession: jest.fn().mockResolvedValue(undefined),
    updatePlaybackPosition: jest.fn(),
  },
}));

jest.mock('../../../src/shared/streaming/onlineNetworkPolicy', () => ({
  isStreamingHubAllowed: () => true,
}));

jest.mock('../../../src/shared/streaming/AimpBroadcastSource', () => ({
  AimpBroadcastSource: class AimpBroadcastSource {},
}));

jest.mock('../../../src/shared/utils', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('../../../src/shared/streaming/partyPlaylistSync', () => ({
  subscribePartyPlaylistSync: jest.fn(() => () => {}),
  subscribeAimpPartyPlaylistSync: jest.fn(() => () => {}),
}));

jest.mock('../../../src/shared/utils/authErrorHandler', () => ({
  isAuthError: (error: unknown) =>
    error instanceof Error &&
    (error.message.includes('Сессия устарела') ||
      error.message.includes('401') ||
      error.message.includes('Unauthorized')),
}));

import type { PlaybackBroadcastSource } from '../../../src/shared/streaming/PlaybackBroadcastSource';
import { StreamingOrchestrator } from '../../../src/shared/streaming/streamingOrchestrator';

const PARTY_ID = '123e4567-e89b-12d3-a456-426614174000';
const RECONNECT_DELAY_MS = 10_000;

function createBroadcastSource(): PlaybackBroadcastSource {
  return {
    sourceId: 'cherryPlayPlayer',
    subscribe: jest.fn(() => () => {}),
    isLiveSessionActive: () => false,
    getPlaylistForApi: () => ({ items: [], totalDuration: 0, totalTracks: 0 }),
    getPlaybackStateDto: () =>
      ({
        trackId: null,
        position: 0,
        status: 'idle',
      }) as ReturnType<PlaybackBroadcastSource['getPlaybackStateDto']>,
    shouldSendPositionTicks: () => false,
    getCurrentTrackId: () => null,
    getPosition: () => 0,
  };
}

async function flushAsyncWork(): Promise<void> {
  for (let i = 0; i < 20; i++) {
    await Promise.resolve();
  }
}

describe('StreamingOrchestrator existence check and durable reconnect', () => {
  let exhaustionHandler: (() => void) | undefined;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    exhaustionHandler = undefined;

    mockOnReconnectionFailed.mockImplementation((handler: (() => void) | null | undefined) => {
      exhaustionHandler = handler ?? undefined;
    });
    mockCheckPartyExists.mockResolvedValue(true);
    mockIsServiceConnected.mockReturnValue(false);
    mockConnect.mockResolvedValue(undefined);
    mockJoinPartyAsOrganizer.mockResolvedValue(undefined);
    mockDisconnect.mockResolvedValue(undefined);
    mockEndSession.mockResolvedValue(undefined);
    mockResetPlaybackState.mockResolvedValue(undefined);
  });

  afterEach(async () => {
    jest.useRealTimers();
  });

  it('notifies onPartyNotFound when party is missing (404 → false) without connecting', async () => {
    mockCheckPartyExists.mockResolvedValue(false);
    const onPartyNotFound = jest.fn();
    const orchestrator = new StreamingOrchestrator();

    orchestrator.start({
      partyId: PARTY_ID,
      broadcastSource: createBroadcastSource(),
      streamingSource: 'cherryPlayPlayer',
      networkSettings: { enableStreaming: true },
      onPartyNotFound,
    });

    await flushAsyncWork();

    expect(onPartyNotFound).toHaveBeenCalledTimes(1);
    expect(mockConnect).not.toHaveBeenCalled();

    await orchestrator.teardown();
    await flushAsyncWork();
  });

  it('does not unlink when existence check is unreachable; schedules reconnect', async () => {
    mockCheckPartyExists.mockRejectedValue(new Error('network down'));
    const onPartyNotFound = jest.fn();
    const onConnectionStateChange = jest.fn();
    const orchestrator = new StreamingOrchestrator();

    orchestrator.start({
      partyId: PARTY_ID,
      broadcastSource: createBroadcastSource(),
      streamingSource: 'cherryPlayPlayer',
      networkSettings: { enableStreaming: true },
      onPartyNotFound,
      onConnectionStateChange,
    });

    await flushAsyncWork();

    expect(onPartyNotFound).not.toHaveBeenCalled();
    expect(onConnectionStateChange).toHaveBeenCalledWith(signalR.HubConnectionState.Disconnected);
    expect(mockCheckPartyExists).toHaveBeenCalledTimes(1);

    mockCheckPartyExists.mockResolvedValue(true);
    await jest.advanceTimersByTimeAsync(RECONNECT_DELAY_MS);
    await flushAsyncWork();

    expect(mockCheckPartyExists).toHaveBeenCalledTimes(2);
    expect(mockConnect).toHaveBeenCalled();

    await orchestrator.teardown();
    await flushAsyncWork();
  });

  it('does not schedule reconnect on definitive auth existence failures', async () => {
    mockCheckPartyExists.mockRejectedValue(new Error('Сессия устарела. Войдите ещё раз.'));
    const onPartyNotFound = jest.fn();
    const onConnectError = jest.fn();
    const orchestrator = new StreamingOrchestrator();

    orchestrator.start({
      partyId: PARTY_ID,
      broadcastSource: createBroadcastSource(),
      streamingSource: 'cherryPlayPlayer',
      networkSettings: { enableStreaming: true },
      onPartyNotFound,
      onConnectError,
    });

    await flushAsyncWork();

    expect(onPartyNotFound).not.toHaveBeenCalled();
    expect(onConnectError).toHaveBeenCalledTimes(1);
    expect(mockConnect).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(RECONNECT_DELAY_MS);
    await flushAsyncWork();

    expect(mockCheckPartyExists).toHaveBeenCalledTimes(1);
    expect(mockConnect).not.toHaveBeenCalled();

    await orchestrator.teardown();
    await flushAsyncWork();
  });

  it('schedules reconnect after SignalR connect failure', async () => {
    mockConnect.mockRejectedValue(new Error('hub unavailable'));
    const onPartyNotFound = jest.fn();
    const onConnectError = jest.fn();
    const orchestrator = new StreamingOrchestrator();

    orchestrator.start({
      partyId: PARTY_ID,
      broadcastSource: createBroadcastSource(),
      streamingSource: 'cherryPlayPlayer',
      networkSettings: { enableStreaming: true },
      onPartyNotFound,
      onConnectError,
    });

    await flushAsyncWork();

    expect(onConnectError).toHaveBeenCalledTimes(1);
    expect(onPartyNotFound).not.toHaveBeenCalled();
    expect(mockConnect).toHaveBeenCalledTimes(1);

    mockConnect.mockResolvedValue(undefined);
    await jest.advanceTimersByTimeAsync(RECONNECT_DELAY_MS);
    await flushAsyncWork();

    expect(mockConnect).toHaveBeenCalledTimes(2);

    await orchestrator.teardown();
    await flushAsyncWork();
  });

  it('teardown cancels pending reconnect so no late connect runs', async () => {
    mockCheckPartyExists.mockRejectedValue(new Error('network down'));
    const orchestrator = new StreamingOrchestrator();

    orchestrator.start({
      partyId: PARTY_ID,
      broadcastSource: createBroadcastSource(),
      streamingSource: 'cherryPlayPlayer',
      networkSettings: { enableStreaming: true },
    });

    await flushAsyncWork();
    expect(mockCheckPartyExists).toHaveBeenCalledTimes(1);

    await orchestrator.teardown();
    await flushAsyncWork();

    mockCheckPartyExists.mockResolvedValue(true);
    await jest.advanceTimersByTimeAsync(RECONNECT_DELAY_MS);
    await flushAsyncWork();

    expect(mockCheckPartyExists).toHaveBeenCalledTimes(1);
    expect(mockConnect).not.toHaveBeenCalled();
  });

  it('schedules durable reconnect after SignalR auto-reconnect exhaustion without unlinking', async () => {
    const onReconnectionFailed = jest.fn();
    const onPartyNotFound = jest.fn();
    const orchestrator = new StreamingOrchestrator();

    orchestrator.start({
      partyId: PARTY_ID,
      broadcastSource: createBroadcastSource(),
      streamingSource: 'cherryPlayPlayer',
      networkSettings: { enableStreaming: true },
      onPartyNotFound,
      onReconnectionFailed,
    });

    await flushAsyncWork();
    expect(mockConnect).toHaveBeenCalledTimes(1);
    expect(mockJoinPartyAsOrganizer).toHaveBeenCalledTimes(1);
    expect(exhaustionHandler).toBeDefined();

    exhaustionHandler?.();
    expect(onReconnectionFailed).toHaveBeenCalledTimes(1);
    expect(onPartyNotFound).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(RECONNECT_DELAY_MS);
    await flushAsyncWork();

    expect(mockConnect).toHaveBeenCalledTimes(2);
    expect(onPartyNotFound).not.toHaveBeenCalled();

    await orchestrator.teardown();
    await flushAsyncWork();
  });
});
