import * as signalR from '@microsoft/signalr';
import { act, renderHook } from '@testing-library/react';

import { partyService } from '../../../src/shared/services/partyService';
import { signalRService } from '../../../src/shared/services/signalRService';
import { useStreamingOrchestrator } from '../../../src/shared/streaming/useStreamingOrchestrator';

jest.mock('../../../src/shared/services/partyService', () => ({
  partyService: { checkServerReachable: jest.fn() },
}));

jest.mock('../../../src/shared/services/signalRService', () => ({
  signalRService: {
    getConnectionState: jest.fn(),
    isServiceConnected: jest.fn().mockReturnValue(true),
  },
}));

jest.mock('../../../src/shared/stores', () => ({
  useSettingsStore: jest.fn((selector: (state: unknown) => unknown) =>
    selector({ enableStreaming: true, streamingSource: 'cherryPlayPlayer' }),
  ),
}));

jest.mock('../../../src/shared/stores/authStore', () => ({
  useAuthStore: Object.assign(
    (
      selector: (state: {
        accessToken: string;
        organizer: { id: string; name: string };
      }) => unknown,
    ) =>
      selector({
        accessToken: 'valid-access-token',
        organizer: { id: 'organizer-1', name: 'Organizer' },
      }),
    {
      getState: () => ({
        accessToken: 'valid-access-token',
        organizer: { id: 'organizer-1', name: 'Organizer' },
      }),
      persist: {
        hasHydrated: () => true,
        onFinishHydration: (_listener: (state: unknown) => void) => () => undefined,
      },
    },
  ),
}));

jest.mock('../../../src/shared/streaming/streamingOrchestrator', () => ({
  streamingOrchestrator: {
    activeConfig: { streamingSource: 'cherryPlayPlayer' },
    isReady: true,
    start: jest.fn(),
    teardown: jest.fn(),
    syncLiveSession: jest.fn(),
    reconnect: jest.fn(),
  },
}));

describe('useStreamingOrchestrator server reachability polling', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(partyService, 'checkServerReachable').mockResolvedValue(true);
    jest
      .spyOn(signalRService, 'getConnectionState')
      .mockReturnValue(signalR.HubConnectionState.Connected);
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('changes to disconnected when the server becomes unreachable', async () => {
    const reachability = jest.spyOn(partyService, 'checkServerReachable');
    const { result } = renderHook(() =>
      useStreamingOrchestrator({ partyId: 'party-1', sessionMode: 'preparation' }),
    );

    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.connectionState).toBe(signalR.HubConnectionState.Connected);

    reachability.mockResolvedValue(false);
    await act(async () => {
      await jest.advanceTimersByTimeAsync(2000);
    });

    expect(result.current.connectionState).toBe(signalR.HubConnectionState.Disconnected);
  });
});
