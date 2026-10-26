import * as signalR from '@microsoft/signalr';

type PlaybackBroadcastSource =
  import('../../../src/shared/streaming/PlaybackBroadcastSource').PlaybackBroadcastSource;

const checkPartyExists = jest.fn<Promise<boolean>, [string]>();
const connected = jest.fn<boolean, []>();
const connect = jest.fn<Promise<void>, []>();
const joinParty = jest.fn<Promise<void>, [string]>();
const startSession = jest.fn<Promise<void>, [string]>();
const endSession = jest.fn<Promise<void>, [string]>();
const endSessionOrThrow = jest.fn<Promise<void>, [string]>();

jest.mock('../../../src/shared/services/partyService', () => ({
  partyService: { checkPartyExists: (...args: [string]) => checkPartyExists(...args) },
}));

jest.mock('../../../src/shared/services/signalRService', () => ({
  signalRService: {
    setPartyReconnectHandler: jest.fn(),
    onReconnectionFailed: jest.fn(),
    isServiceConnected: () => connected(),
    getConnectionState: () =>
      connected() ? signalR.HubConnectionState.Connected : signalR.HubConnectionState.Disconnected,
    connect: () => connect(),
    joinPartyAsOrganizer: (...args: [string]) => joinParty(...args),
    startSession: (...args: [string]) => startSession(...args),
    endSession: (...args: [string]) => endSession(...args),
    endSessionOrThrow: (...args: [string]) => endSessionOrThrow(...args),
    notifyStateChangedOrThrow: jest.fn().mockResolvedValue(undefined),
    updateFullStateOrThrow: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    resetPlaybackState: jest.fn().mockResolvedValue(undefined),
    updatePlaybackPosition: jest.fn(),
  },
}));

jest.mock('../../../src/shared/streaming/onlineNetworkPolicy', () => ({
  isStreamingHubAllowed: () => true,
}));

jest.mock('../../../src/shared/streaming/partyPlaylistSync', () => ({
  subscribePartyPlaylistSync: jest.fn(() => () => undefined),
  subscribeAimpPartyPlaylistSync: jest.fn(() => () => undefined),
}));

jest.mock('../../../src/shared/streaming/AimpBroadcastSource', () => ({
  AimpBroadcastSource: class {},
}));

jest.mock('../../../src/shared/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { StreamingOrchestrator } from '../../../src/shared/streaming/streamingOrchestrator';

const deferred = <T>() => {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
};

const createSource = (): PlaybackBroadcastSource => ({
  sourceId: 'cherryPlayPlayer',
  subscribe: jest.fn(() => () => undefined),
  getPlaybackStateDto: () => ({
    currentTrackId: null,
    status: 'idle',
    position: 0,
    duration: 0,
    volume: 1,
    mode: 'session',
    playedTrackIds: [],
    disabledTrackIds: [],
    disabledGroupIds: [],
    lastUpdatedAt: '2026-10-25T00:00:00.000Z',
  }),
  getCurrentTrackId: () => null,
  getPosition: () => 0,
  getPlaylistForApi: () => ({ items: [], totalTracks: 0, totalDuration: 0 }),
  isLiveSessionActive: () => true,
  shouldSendPositionTicks: () => false,
});

const flushAsyncWork = async (): Promise<void> => {
  for (let index = 0; index < 30; index++) await Promise.resolve();
};

describe('StreamingOrchestrator pending session stop', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    checkPartyExists.mockReset().mockResolvedValue(true);
    connected.mockReset().mockReturnValue(false);
    connect.mockReset().mockImplementation(() => {
      connected.mockReturnValue(true);
      return Promise.resolve();
    });
    joinParty.mockReset().mockResolvedValue(undefined);
    startSession.mockReset().mockResolvedValue(undefined);
    endSession.mockReset().mockResolvedValue(undefined);
    endSessionOrThrow.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('ends a session when start succeeds after teardown begins', async () => {
    const pendingStart = deferred<void>();
    startSession.mockReturnValue(pendingStart.promise);
    const orchestrator = new StreamingOrchestrator();
    orchestrator.start({
      partyId: 'party-1',
      broadcastSource: createSource(),
      streamingSource: 'cherryPlayPlayer',
      networkSettings: { enableStreaming: true },
    });
    await flushAsyncWork();
    expect(startSession).toHaveBeenCalledWith('party-1');

    const teardown = orchestrator.teardown();
    await flushAsyncWork();
    expect(endSession).not.toHaveBeenCalled();
    pendingStart.resolve();
    await teardown;

    expect(endSession).toHaveBeenCalledTimes(1);
    expect(endSession).toHaveBeenCalledWith('party-1');
  });

  it('tears down after a stalled start times out and allows a later retry', async () => {
    startSession.mockReturnValueOnce(new Promise<void>(() => undefined));
    const orchestrator = new StreamingOrchestrator();
    const config = {
      partyId: 'party-1',
      broadcastSource: createSource(),
      streamingSource: 'cherryPlayPlayer' as const,
      networkSettings: { enableStreaming: true },
    };
    orchestrator.start(config);
    await flushAsyncWork();
    expect(startSession).toHaveBeenCalledTimes(1);

    const teardown = orchestrator.teardown();
    await jest.advanceTimersByTimeAsync(8_000);
    await teardown;
    expect(endSession).toHaveBeenCalledWith('party-1');

    orchestrator.start(config);
    await flushAsyncWork();
    expect(startSession).toHaveBeenCalledTimes(2);
    await orchestrator.teardown();
  });

  it('does not end a newer successful session when an older timed-out start resolves late', async () => {
    const oldStart = deferred<void>();
    startSession.mockReturnValueOnce(oldStart.promise).mockResolvedValueOnce(undefined);
    const orchestrator = new StreamingOrchestrator();
    orchestrator.start({
      partyId: 'party-1',
      broadcastSource: createSource(),
      streamingSource: 'cherryPlayPlayer',
      networkSettings: { enableStreaming: true },
    });
    await flushAsyncWork();
    expect(startSession).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(8_000);
    orchestrator.reconnect();
    await flushAsyncWork();
    expect(startSession).toHaveBeenCalledTimes(2);

    oldStart.resolve();
    await flushAsyncWork();

    expect(endSession).not.toHaveBeenCalled();
    await orchestrator.teardown();
  });

  it('ends a late timed-out start for another party without ending the active party', async () => {
    const partyAStart = deferred<void>();
    startSession.mockImplementation((partyId) =>
      partyId === 'party-a' ? partyAStart.promise : Promise.resolve(),
    );
    const orchestrator = new StreamingOrchestrator();
    orchestrator.start({
      partyId: 'party-a',
      broadcastSource: createSource(),
      streamingSource: 'cherryPlayPlayer',
      networkSettings: { enableStreaming: true },
    });
    await flushAsyncWork();
    expect(startSession).toHaveBeenCalledWith('party-a');

    await jest.advanceTimersByTimeAsync(8_000);
    orchestrator.start({
      partyId: 'party-b',
      broadcastSource: createSource(),
      streamingSource: 'cherryPlayPlayer',
      networkSettings: { enableStreaming: true },
    });
    await flushAsyncWork();
    expect(startSession).toHaveBeenCalledWith('party-b');

    partyAStart.resolve();
    await flushAsyncWork();
    expect(endSession).toHaveBeenCalledTimes(1);
    expect(endSession).toHaveBeenCalledWith('party-a');

    await orchestrator.teardown();
    expect(endSession).toHaveBeenCalledWith('party-b');
  });

  it('ends a stale party start that succeeds after switching to another party', async () => {
    const partyAStart = deferred<void>();
    startSession.mockImplementation((partyId) =>
      partyId === 'party-a' ? partyAStart.promise : Promise.resolve(),
    );
    const orchestrator = new StreamingOrchestrator();
    orchestrator.start({
      partyId: 'party-a',
      broadcastSource: createSource(),
      streamingSource: 'cherryPlayPlayer',
      networkSettings: { enableStreaming: true },
    });
    await flushAsyncWork();
    expect(startSession).toHaveBeenCalledWith('party-a');

    orchestrator.start({
      partyId: 'party-b',
      broadcastSource: createSource(),
      streamingSource: 'cherryPlayPlayer',
      networkSettings: { enableStreaming: true },
    });
    await flushAsyncWork();
    expect(startSession).toHaveBeenCalledWith('party-b');

    partyAStart.resolve();
    await flushAsyncWork();
    expect(endSession).toHaveBeenCalledTimes(1);
    expect(endSession).toHaveBeenCalledWith('party-a');

    await orchestrator.teardown();
    expect(endSession).toHaveBeenCalledWith('party-b');
  });

  it('ends an older timed-out start if the newer same-party session was already torn down', async () => {
    const oldStart = deferred<void>();
    startSession.mockReturnValueOnce(oldStart.promise).mockResolvedValueOnce(undefined);
    const orchestrator = new StreamingOrchestrator();
    orchestrator.start({
      partyId: 'party-1',
      broadcastSource: createSource(),
      streamingSource: 'cherryPlayPlayer',
      networkSettings: { enableStreaming: true },
    });
    await flushAsyncWork();
    expect(startSession).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(8_000);
    orchestrator.reconnect();
    await flushAsyncWork();
    expect(startSession).toHaveBeenCalledTimes(2);

    await orchestrator.teardown();
    expect(endSession).toHaveBeenCalledTimes(1);

    oldStart.resolve();
    await flushAsyncWork();
    expect(endSession).toHaveBeenCalledTimes(2);
    expect(endSession).toHaveBeenNthCalledWith(1, 'party-1');
    expect(endSession).toHaveBeenNthCalledWith(2, 'party-1');
  });

  it('keeps a newer same-party start active when an older timed-out start resolves first', async () => {
    const oldStart = deferred<void>();
    const retryStart = deferred<void>();
    startSession.mockReturnValueOnce(oldStart.promise).mockReturnValueOnce(retryStart.promise);
    const orchestrator = new StreamingOrchestrator();
    orchestrator.start({
      partyId: 'party-1',
      broadcastSource: createSource(),
      streamingSource: 'cherryPlayPlayer',
      networkSettings: { enableStreaming: true },
    });
    await flushAsyncWork();
    expect(startSession).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(8_000);
    orchestrator.reconnect();
    await flushAsyncWork();
    expect(startSession).toHaveBeenCalledTimes(2);

    oldStart.resolve();
    await flushAsyncWork();
    expect(endSession).not.toHaveBeenCalled();

    retryStart.resolve();
    await flushAsyncWork();
    expect(endSession).not.toHaveBeenCalled();

    await orchestrator.teardown();
    expect(endSession).toHaveBeenCalledTimes(1);
    expect(endSession).toHaveBeenCalledWith('party-1');
  });

  it('cleans up an old timed-out start after explicitly ending the newer session', async () => {
    const oldStart = deferred<void>();
    startSession.mockReturnValueOnce(oldStart.promise).mockResolvedValueOnce(undefined);
    const orchestrator = new StreamingOrchestrator();
    orchestrator.start({
      partyId: 'party-1',
      broadcastSource: createSource(),
      streamingSource: 'cherryPlayPlayer',
      networkSettings: { enableStreaming: true },
    });
    await flushAsyncWork();
    expect(startSession).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(8_000);
    orchestrator.reconnect();
    await flushAsyncWork();
    expect(startSession).toHaveBeenCalledTimes(2);

    await orchestrator.endServerSession();
    expect(endSessionOrThrow).toHaveBeenCalledWith('party-1');
    expect(endSession).not.toHaveBeenCalled();

    oldStart.resolve();
    await flushAsyncWork();
    expect(endSession).toHaveBeenCalledTimes(1);
    expect(endSession).toHaveBeenCalledWith('party-1');
    await orchestrator.teardown();
  });

  it('cleans up an old timed-out start after AIMP live session is stopped', async () => {
    const oldStart = deferred<void>();
    startSession.mockReturnValueOnce(oldStart.promise).mockResolvedValueOnce(undefined);
    const orchestrator = new StreamingOrchestrator();
    orchestrator.start({
      partyId: 'party-1',
      broadcastSource: { ...createSource(), sourceId: 'aimp' },
      streamingSource: 'aimp',
      networkSettings: { enableStreaming: true },
    });
    await flushAsyncWork();
    expect(startSession).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(8_000);
    orchestrator.reconnect();
    await flushAsyncWork();
    expect(startSession).toHaveBeenCalledTimes(2);

    orchestrator.syncLiveSession(false);
    await flushAsyncWork();
    expect(endSession).toHaveBeenCalledTimes(1);

    oldStart.resolve();
    await flushAsyncWork();
    expect(endSession).toHaveBeenCalledTimes(2);
    expect(endSession).toHaveBeenNthCalledWith(1, 'party-1');
    expect(endSession).toHaveBeenNthCalledWith(2, 'party-1');
    await orchestrator.teardown();
  });

  it('preserves a new same-party owner when an older end request completes late', async () => {
    const oldStart = deferred<void>();
    const pendingEnd = deferred<void>();
    startSession
      .mockReturnValueOnce(oldStart.promise)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined);
    endSession.mockReturnValueOnce(pendingEnd.promise);
    const orchestrator = new StreamingOrchestrator();
    orchestrator.start({
      partyId: 'party-1',
      broadcastSource: { ...createSource(), sourceId: 'aimp' },
      streamingSource: 'aimp',
      networkSettings: { enableStreaming: true },
    });
    await flushAsyncWork();
    expect(startSession).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(8_000);
    orchestrator.reconnect();
    await flushAsyncWork();
    expect(startSession).toHaveBeenCalledTimes(2);

    orchestrator.syncLiveSession(false);
    await flushAsyncWork();
    expect(endSession).toHaveBeenCalledTimes(1);

    orchestrator.syncLiveSession(true);
    await flushAsyncWork();
    expect(startSession).toHaveBeenCalledTimes(3);

    pendingEnd.resolve();
    await flushAsyncWork();
    oldStart.resolve();
    await flushAsyncWork();

    expect(endSession).toHaveBeenCalledTimes(1);
    await orchestrator.teardown();
  });
});
