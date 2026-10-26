import * as signalR from '@microsoft/signalr';
import { act, renderHook } from '@testing-library/react';

const checkServerReachable = jest.fn<Promise<boolean>, []>();
const checkPartyExists = jest.fn<Promise<boolean>, [string]>();
const isConnected = jest.fn<boolean, []>();
const connect = jest.fn<Promise<void>, []>();
const joinParty = jest.fn<Promise<void>, [string]>();
const notifyState = jest.fn<Promise<void>, [string]>();
const updateFullState = jest.fn<Promise<void>, [string, unknown]>();
const authState = {
  accessToken: null as string | null,
  organizer: null as { id: string; name: string } | null,
};
let authHydrated = false;
const hydrationListeners = new Set<(state: typeof authState) => void>();
const finishAuthHydration = (): void => {
  authHydrated = true;
  hydrationListeners.forEach((listener) => listener(authState));
};
const useAuthStore = Object.assign(
  (selector: (state: typeof authState) => unknown) => selector(authState),
  {
    getState: () => authState,
    persist: {
      hasHydrated: () => authHydrated,
      onFinishHydration: (listener: (state: typeof authState) => void) => {
        hydrationListeners.add(listener);
        return () => hydrationListeners.delete(listener);
      },
    },
  },
);
const requestLog: string[] = [];
const deferred = <T,>() => {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
};

jest.mock('../../../src/shared/services/partyService', () => ({
  partyService: {
    checkServerReachable: () => {
      requestLog.push(`server:${authState.accessToken ?? 'none'}`);
      return checkServerReachable();
    },
    checkPartyExists: (partyId: string) => {
      requestLog.push(`party:${authState.accessToken ?? 'none'}`);
      return checkPartyExists(partyId);
    },
  },
}));

jest.mock('../../../src/shared/services/signalRService', () => ({
  signalRService: {
    setPartyReconnectHandler: jest.fn(),
    onReconnectionFailed: jest.fn(),
    isServiceConnected: () => isConnected(),
    getConnectionState: () =>
      isConnected()
        ? signalR.HubConnectionState.Connected
        : signalR.HubConnectionState.Disconnected,
    connect: () => {
      requestLog.push(`connect:${authState.accessToken ?? 'none'}`);
      return connect();
    },
    joinPartyAsOrganizer: (partyId: string) => {
      requestLog.push(`join:${authState.accessToken ?? 'none'}`);
      return joinParty(partyId);
    },
    notifyStateChangedOrThrow: (partyId: string) => notifyState(partyId),
    updateFullStateOrThrow: (partyId: string, state: unknown) => updateFullState(partyId, state),
    startSession: jest.fn().mockResolvedValue(undefined),
    updatePlaybackPosition: jest.fn(),
    disconnect: jest.fn().mockResolvedValue(undefined),
    endSession: jest.fn().mockResolvedValue(undefined),
    resetPlaybackState: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../../src/shared/stores/settingsStore', () => ({
  useSettingsStore: (selector: (state: unknown) => unknown) =>
    selector({ enableStreaming: true, streamingSource: 'cherryPlayPlayer' }),
}));
jest.mock('../../../src/shared/stores/authStore', () => ({ useAuthStore }));
jest.mock('../../../src/shared/streaming/onlineNetworkPolicy', () => ({
  isStreamingHubAllowed: () => true,
  isStreamingNetworkEnabled: () => true,
}));
jest.mock('../../../src/shared/streaming/CherryPlayPlayerBroadcastSource', () => ({
  CherryPlayPlayerBroadcastSource: class {
    sourceId = 'cherryPlayPlayer';
    subscribe = jest.fn(() => () => undefined);
    isLiveSessionActive = () => false;
    getPlaylistForApi = () => ({ items: [], totalDuration: 0, totalTracks: 0 });
    getPlaybackStateDto = () => ({ trackId: null, position: 0, status: 'idle' });
    shouldSendPositionTicks = () => false;
    getCurrentTrackId = () => null;
    getPosition = () => 0;
  },
}));
jest.mock('../../../src/shared/streaming/AimpBroadcastSource', () => ({
  AimpBroadcastSource: class {},
}));
jest.mock('../../../src/shared/streaming/partyPlaylistSync', () => ({
  subscribePartyPlaylistSync: jest.fn(() => () => undefined),
  subscribeAimpPartyPlaylistSync: jest.fn(() => () => undefined),
}));
jest.mock('../../../src/shared/utils', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock('../../../src/shared/utils/authErrorHandler', () => ({ isAuthError: () => false }));

import { streamingOrchestrator } from '../../../src/shared/streaming/streamingOrchestrator';
import { useStreamingOrchestrator } from '../../../src/shared/streaming/useStreamingOrchestrator';

const flushAsyncWork = async (): Promise<void> => {
  for (let index = 0; index < 30; index++) await Promise.resolve();
};

describe('streaming recovery acceptance', () => {
  beforeEach(() => {
    authState.accessToken = null;
    authState.organizer = null;
    authHydrated = false;
    hydrationListeners.clear();
    requestLog.length = 0;
    jest.useFakeTimers();
    checkServerReachable.mockReset().mockResolvedValue(false);
    checkPartyExists.mockReset().mockRejectedValue(new Error('network unavailable'));
    isConnected.mockReset().mockReturnValue(false);
    connect.mockReset().mockImplementation(() => {
      isConnected.mockReturnValue(true);
      return Promise.resolve();
    });
    joinParty.mockReset().mockResolvedValue(undefined);
    notifyState.mockReset().mockResolvedValue(undefined);
    updateFullState.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('recovers an offline launch after online returns when auth was already hydrated', async () => {
    authHydrated = true;
    authState.accessToken = 'ready-token';
    authState.organizer = { id: 'organizer-1', name: 'Organizer' };
    const { result } = renderHook(() =>
      useStreamingOrchestrator({ partyId: 'party-offline', sessionMode: 'session' }),
    );
    await act(async () => flushAsyncWork());
    expect(result.current.connectionState).toBe(signalR.HubConnectionState.Disconnected);
    expect(joinParty).not.toHaveBeenCalled();

    checkServerReachable.mockResolvedValue(true);
    checkPartyExists.mockResolvedValue(true);
    await act(async () => {
      window.dispatchEvent(new Event('online'));
      await flushAsyncWork();
    });

    expect(joinParty).toHaveBeenCalledWith('party-offline');
    expect(notifyState).toHaveBeenCalledWith('party-offline');
    expect(updateFullState).toHaveBeenCalledWith(
      'party-offline',
      expect.objectContaining({ status: 'idle' }),
    );
    expect(result.current.connectionState).toBe(signalR.HubConnectionState.Connected);
    await act(async () => streamingOrchestrator.teardown());
  });

  it('waits for persisted auth hydration before making network or SignalR requests', async () => {
    checkServerReachable.mockResolvedValue(true);
    expect(authHydrated).toBe(false);
    expect(authState.accessToken).toBeNull();
    const { result, rerender } = renderHook(() =>
      useStreamingOrchestrator({ partyId: 'party-auth', sessionMode: 'session' }),
    );
    await act(async () => flushAsyncWork());

    expect(requestLog).toEqual([]);
    expect(checkPartyExists).not.toHaveBeenCalled();
    expect(checkServerReachable).not.toHaveBeenCalled();
    expect(connect).not.toHaveBeenCalled();
    expect(joinParty).not.toHaveBeenCalled();

    authState.accessToken = 'hydrated-token';
    authState.organizer = { id: 'organizer-auth', name: 'Hydrated organizer' };
    checkPartyExists.mockResolvedValue(true);
    finishAuthHydration();
    rerender();
    await act(async () => flushAsyncWork());

    expect(requestLog).toEqual(
      expect.arrayContaining([
        'party:hydrated-token',
        'server:hydrated-token',
        'connect:hydrated-token',
        'join:hydrated-token',
      ]),
    );
    expect(joinParty).toHaveBeenCalledWith('party-auth');
    expect(notifyState).toHaveBeenCalledWith('party-auth');
    expect(result.current.connectionState).toBe(signalR.HubConnectionState.Connected);
    await act(async () => streamingOrchestrator.teardown());
  });

  it('coalesces online and healthy-network recovery triggers during an in-flight connect', async () => {
    authHydrated = true;
    authState.accessToken = 'ready-token';
    authState.organizer = { id: 'organizer-1', name: 'Organizer' };
    checkServerReachable.mockReset().mockResolvedValueOnce(false).mockResolvedValue(true);
    checkPartyExists
      .mockReset()
      .mockRejectedValueOnce(new Error('network unavailable'))
      .mockResolvedValue(true);
    const { result } = renderHook(() =>
      useStreamingOrchestrator({ partyId: 'party-trigger-race', sessionMode: 'session' }),
    );
    await act(async () => flushAsyncWork());
    expect(connect).not.toHaveBeenCalled();

    const connectGate = deferred<void>();
    connect.mockImplementationOnce(() =>
      connectGate.promise.then(() => {
        isConnected.mockReturnValue(true);
      }),
    );
    await act(async () => {
      window.dispatchEvent(new Event('online'));
      await flushAsyncWork();
    });
    expect(connect).toHaveBeenCalledTimes(1);

    await act(async () => {
      await jest.advanceTimersByTimeAsync(2000);
      await flushAsyncWork();
    });
    expect(connect).toHaveBeenCalledTimes(1);
    expect(joinParty).not.toHaveBeenCalled();

    await act(async () => {
      connectGate.resolve();
      await flushAsyncWork();
    });
    expect(connect).toHaveBeenCalledTimes(1);
    expect(joinParty).toHaveBeenCalledTimes(1);
    expect(notifyState).toHaveBeenCalledTimes(1);
    expect(result.current.connectionState).toBe(signalR.HubConnectionState.Connected);
    await act(async () => streamingOrchestrator.teardown());
  });
});
