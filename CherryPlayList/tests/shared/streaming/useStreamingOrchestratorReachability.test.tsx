import * as signalR from '@microsoft/signalr';
import { act, renderHook } from '@testing-library/react';

import { partyService } from '../../../src/shared/services/partyService';
import { signalRService } from '../../../src/shared/services/signalRService';
import { useSettingsStore } from '../../../src/shared/stores';
import { streamingOrchestrator } from '../../../src/shared/streaming/streamingOrchestrator';
import { useStreamingOrchestrator } from '../../../src/shared/streaming/useStreamingOrchestrator';

jest.mock('../../../src/shared/services/partyService', () => ({
  partyService: { checkServerReachable: jest.fn() },
}));

jest.mock('../../../src/shared/services/signalRService', () => ({
  signalRService: { getConnectionState: jest.fn() },
}));

jest.mock('../../../src/shared/stores', () => ({
  useSettingsStore: jest.fn((selector: (state: unknown) => unknown) =>
    selector({ enableStreaming: true, streamingSource: 'cherryPlayPlayer' }),
  ),
}));

jest.mock('../../../src/shared/streaming/streamingOrchestrator', () => ({
  streamingOrchestrator: {
    activeConfig: { streamingSource: 'cherryPlayPlayer' },
    start: jest.fn(),
    teardown: jest.fn(),
    syncLiveSession: jest.fn(),
    reconnect: jest.fn(),
  },
}));

describe('useStreamingOrchestrator server reachability polling', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.mocked(partyService.checkServerReachable).mockResolvedValue(true);
    jest.mocked(signalRService.getConnectionState).mockReturnValue(signalR.HubConnectionState.Connected);
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('changes to disconnected when the server becomes unreachable', async () => {
    const reachability = jest.mocked(partyService.checkServerReachable);
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
