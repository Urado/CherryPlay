import * as signalR from '@microsoft/signalr';

type PlaybackBroadcastSource =
  import('../../../src/shared/streaming/PlaybackBroadcastSource').PlaybackBroadcastSource;

const checkPartyExists = jest.fn<Promise<boolean>, [string]>();
const connected = jest.fn<boolean, []>();
const connect = jest.fn<Promise<void>, []>();
const joinParty = jest.fn<Promise<void>, [string]>();
const startSession = jest.fn<Promise<void>, [string]>();
const notifyState = jest.fn<Promise<void>, [string]>();
const updateFullState = jest.fn<Promise<void>, [string, unknown]>();
const reconnectHandler = jest.fn();
let reconnectionExhaustedHandler: (() => void) | undefined;

jest.mock('../../../src/shared/services/partyService', () => ({
  partyService: {
    checkPartyExists: (...args: [string]): Promise<boolean> =>
      checkPartyExists(...args).then((exists: unknown) => exists === true),
  },
}));
jest.mock('../../../src/shared/services/signalRService', () => ({
  signalRService: {
    setPartyReconnectHandler: (...args: unknown[]) => {
      reconnectHandler(...args);
    },
    onReconnectionFailed: (handler?: () => void) => {
      reconnectionExhaustedHandler = handler;
    },
    isServiceConnected: () => connected(),
    getConnectionState: () =>
      connected() ? signalR.HubConnectionState.Connected : signalR.HubConnectionState.Disconnected,
    connect: () => connect(),
    joinPartyAsOrganizer: (...args: [string]) => joinParty(...args),
    startSession: (...args: [string]) => startSession(...args),
    notifyStateChangedOrThrow: (...args: [string]) => notifyState(...args),
    updateFullStateOrThrow: (...args: [string, unknown]) => updateFullState(...args),
    disconnect: jest.fn().mockResolvedValue(undefined),
    endSession: jest.fn().mockResolvedValue(undefined),
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

const createSource = (live = false): PlaybackBroadcastSource => ({
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
  isLiveSessionActive: () => live,
  shouldSendPositionTicks: () => false,
});

const flushAsyncWork = async (): Promise<void> => {
  for (let index = 0; index < 30; index++) await Promise.resolve();
};

const deferred = <T>() => {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
};

describe('StreamingOrchestrator restoration acceptance', () => {
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
    notifyState.mockReset().mockResolvedValue(undefined);
    updateFullState.mockReset().mockResolvedValue(undefined);
    reconnectHandler.mockReset();
    reconnectionExhaustedHandler = undefined;
  });

  afterEach(async () => {
    await new StreamingOrchestrator().teardown();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('rejoins and republishes state when transport is connected but join was never confirmed', async () => {
    connected.mockReturnValue(true);
    const orchestrator = new StreamingOrchestrator();
    orchestrator.start({
      partyId: 'party-1',
      broadcastSource: createSource(),
      streamingSource: 'cherryPlayPlayer',
      networkSettings: { enableStreaming: true },
    });
    await flushAsyncWork();

    expect(joinParty).toHaveBeenCalledWith('party-1');
    expect(notifyState).toHaveBeenCalledWith('party-1');
    expect(updateFullState).toHaveBeenCalledWith(
      'party-1',
      expect.objectContaining({ status: 'idle' }),
    );
    await orchestrator.teardown();
  });

  it('retries StartSession after the first request fails', async () => {
    const orchestrator = new StreamingOrchestrator();
    startSession.mockRejectedValueOnce(new Error('temporary hub failure'));
    orchestrator.start({
      partyId: 'party-1',
      broadcastSource: createSource(true),
      streamingSource: 'cherryPlayPlayer',
      networkSettings: { enableStreaming: true },
    });
    await flushAsyncWork();
    orchestrator.reconnect();
    await flushAsyncWork();

    expect(startSession).toHaveBeenCalledTimes(2);
    await orchestrator.teardown();
  });

  it('lets a manual retry supersede an existence check that never resolves', async () => {
    let resolveFirst: ((value: boolean) => void) | undefined;
    checkPartyExists.mockImplementationOnce(
      () => new Promise<boolean>((resolve) => (resolveFirst = resolve)),
    );
    const orchestrator = new StreamingOrchestrator();
    orchestrator.start({
      partyId: 'party-1',
      broadcastSource: createSource(),
      streamingSource: 'cherryPlayPlayer',
      networkSettings: { enableStreaming: true },
    });
    await flushAsyncWork();
    orchestrator.reconnect();
    await flushAsyncWork();

    expect(checkPartyExists).toHaveBeenCalledTimes(2);
    resolveFirst?.(false);
    await orchestrator.teardown();
  });

  it('waits for the latest full-state revision before declaring the connection ready', async () => {
    const initialSync = deferred<void>();
    const latestPublish = deferred<void>();
    const connectionStates: Array<signalR.HubConnectionState | null> = [];
    let notifySourceChanged: (() => void) | undefined;
    let playbackState = createSource().getPlaybackStateDto();
    const source: PlaybackBroadcastSource = {
      ...createSource(),
      subscribe: (callback) => {
        notifySourceChanged = callback;
        return () => undefined;
      },
      getPlaybackStateDto: () => playbackState,
    };
    updateFullState.mockImplementation((_partyId, state) =>
      (state as { status: string }).status === 'playing'
        ? latestPublish.promise
        : initialSync.promise,
    );
    const orchestrator = new StreamingOrchestrator();
    orchestrator.start({
      partyId: 'party-revision',
      broadcastSource: source,
      streamingSource: 'cherryPlayPlayer',
      networkSettings: { enableStreaming: true },
      onConnectionStateChange: (state) => connectionStates.push(state),
    });
    await flushAsyncWork();
    expect(notifyState).toHaveBeenCalledTimes(1);

    playbackState = { ...playbackState, status: 'playing' };
    notifySourceChanged?.();
    await jest.advanceTimersByTimeAsync(50);
    expect(notifyState).toHaveBeenCalledTimes(2);
    expect(updateFullState).toHaveBeenCalledWith(
      'party-revision',
      expect.objectContaining({ status: 'playing' }),
    );

    initialSync.resolve();
    await flushAsyncWork();
    expect(updateFullState).toHaveBeenCalledWith(
      'party-revision',
      expect.objectContaining({ status: 'idle' }),
    );
    expect(connectionStates).not.toContain(signalR.HubConnectionState.Connected);
    expect(updateFullState).toHaveBeenLastCalledWith(
      'party-revision',
      expect.objectContaining({ status: 'playing' }),
    );

    latestPublish.resolve();
    await flushAsyncWork();
    expect(updateFullState).toHaveBeenLastCalledWith(
      'party-revision',
      expect.objectContaining({ status: 'playing' }),
    );
    expect(connectionStates.at(-1)).toBe(signalR.HubConnectionState.Connected);
    await orchestrator.teardown();
  });

  it('keeps a revision retryable when transport drops after join and before full-state publish', async () => {
    const connectionStates: Array<signalR.HubConnectionState | null> = [];
    let firstJoin = true;
    joinParty.mockImplementation(() => {
      if (firstJoin) {
        firstJoin = false;
        connected.mockReturnValue(false);
      }
      return Promise.resolve();
    });
    let publishSourceChange: (() => void) | undefined;
    const source: PlaybackBroadcastSource = {
      ...createSource(),
      subscribe: (callback) => {
        publishSourceChange = callback;
        callback();
        return () => undefined;
      },
      getPlaybackStateDto: () => ({
        currentTrackId: 'track-latest',
        status: 'playing',
        position: 12,
        duration: 180,
        volume: 1,
        mode: 'session',
        playedTrackIds: [],
        disabledTrackIds: [],
        disabledGroupIds: [],
        lastUpdatedAt: '2026-10-25T00:00:00.000Z',
      }),
    };
    const orchestrator = new StreamingOrchestrator();
    orchestrator.start({
      partyId: 'party-drop-before-publish',
      broadcastSource: source,
      streamingSource: 'cherryPlayPlayer',
      networkSettings: { enableStreaming: true },
      onConnectionStateChange: (state) => connectionStates.push(state),
    });
    await flushAsyncWork();

    expect(joinParty).toHaveBeenCalledTimes(1);
    expect(publishSourceChange).toEqual(expect.any(Function));
    expect(connectionStates).not.toContain(signalR.HubConnectionState.Connected);
    expect(notifyState).not.toHaveBeenCalled();
    expect(updateFullState).not.toHaveBeenCalled();

    publishSourceChange?.();
    orchestrator.reconnect();
    await flushAsyncWork();

    expect(connect).toHaveBeenCalledTimes(2);
    expect(joinParty).toHaveBeenCalledTimes(2);
    expect(updateFullState).toHaveBeenCalledWith(
      'party-drop-before-publish',
      expect.objectContaining({ currentTrackId: 'track-latest', status: 'playing' }),
    );
    expect(connectionStates.at(-1)).toBe(signalR.HubConnectionState.Connected);
    await orchestrator.teardown();
  });

  it('clears an exhaustion retry timer when active recovery reaches ready', async () => {
    const recoveryPublish = deferred<void>();
    const connectionStates: Array<signalR.HubConnectionState | null> = [];
    const orchestrator = new StreamingOrchestrator();
    orchestrator.start({
      partyId: 'party-retry-timer',
      broadcastSource: createSource(),
      streamingSource: 'cherryPlayPlayer',
      networkSettings: { enableStreaming: true },
      onConnectionStateChange: (state) => connectionStates.push(state),
    });
    await flushAsyncWork();
    expect(connectionStates.at(-1)).toBe(signalR.HubConnectionState.Connected);
    const initialJoinCount = joinParty.mock.calls.length;
    const initialStatePublishCount = updateFullState.mock.calls.length;
    updateFullState.mockImplementationOnce(() => recoveryPublish.promise);

    orchestrator.reconnect();
    await flushAsyncWork();
    expect(joinParty).toHaveBeenCalledTimes(initialJoinCount + 1);
    expect(updateFullState).toHaveBeenCalledTimes(initialStatePublishCount + 1);
    expect(reconnectionExhaustedHandler).toEqual(expect.any(Function));
    reconnectionExhaustedHandler?.();

    recoveryPublish.resolve();
    await flushAsyncWork();
    expect(connectionStates.at(-1)).toBe(signalR.HubConnectionState.Connected);
    const readyJoinCount = joinParty.mock.calls.length;
    const readyStatePublishCount = updateFullState.mock.calls.length;

    await jest.advanceTimersByTimeAsync(10_000);
    await flushAsyncWork();

    expect(joinParty).toHaveBeenCalledTimes(readyJoinCount);
    expect(updateFullState).toHaveBeenCalledTimes(readyStatePublishCount);
    await orchestrator.teardown();
  });

  it('ignores a late JoinParty response after timeout and completes one retry', async () => {
    const firstJoin = deferred<void>();
    const retryJoin = deferred<void>();
    const connectionStates: Array<signalR.HubConnectionState | null> = [];
    joinParty
      .mockImplementationOnce(() => firstJoin.promise)
      .mockImplementationOnce(() => retryJoin.promise);
    const orchestrator = new StreamingOrchestrator();
    orchestrator.start({
      partyId: 'party-late-join',
      broadcastSource: createSource(),
      streamingSource: 'cherryPlayPlayer',
      networkSettings: { enableStreaming: true },
      onConnectionStateChange: (state) => connectionStates.push(state),
    });
    await flushAsyncWork();
    expect(joinParty).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(8_000);
    await flushAsyncWork();
    expect(connectionStates).not.toContain(signalR.HubConnectionState.Connected);
    expect(notifyState).not.toHaveBeenCalled();
    expect(updateFullState).not.toHaveBeenCalled();

    firstJoin.resolve();
    await flushAsyncWork();
    expect(joinParty).toHaveBeenCalledTimes(1);
    expect(notifyState).not.toHaveBeenCalled();
    expect(updateFullState).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(10_000);
    await flushAsyncWork();
    expect(joinParty).toHaveBeenCalledTimes(2);
    retryJoin.resolve();
    await flushAsyncWork();
    expect(joinParty).toHaveBeenCalledTimes(2);
    expect(notifyState).toHaveBeenCalledTimes(1);
    expect(updateFullState).toHaveBeenCalledTimes(1);
    expect(connectionStates.at(-1)).toBe(signalR.HubConnectionState.Connected);

    await jest.advanceTimersByTimeAsync(60_000);
    await flushAsyncWork();
    expect(joinParty).toHaveBeenCalledTimes(2);
    await orchestrator.teardown();
  });
});
