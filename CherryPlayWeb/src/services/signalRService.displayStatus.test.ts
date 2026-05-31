import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockOn = vi.fn();
const mockOff = vi.fn();
const mockStart = vi.fn().mockResolvedValue(undefined);
const mockConnection = {
  on: mockOn,
  off: mockOff,
  start: mockStart,
  stop: vi.fn().mockResolvedValue(undefined),
  invoke: vi.fn().mockResolvedValue(null),
  onclose: vi.fn(),
  onreconnecting: vi.fn(),
  onreconnected: vi.fn(),
  state: 'Connected',
  connectionId: 'conn-1',
};

vi.mock('@microsoft/signalr', () => ({
  HubConnectionBuilder: vi.fn().mockImplementation(() => ({
    withUrl: vi.fn().mockReturnThis(),
    withAutomaticReconnect: vi.fn().mockReturnThis(),
    build: vi.fn().mockReturnValue(mockConnection),
  })),
  HubConnectionState: {
    Connected: 'Connected',
    Disconnected: 'Disconnected',
  },
}));

vi.mock('../config/apiConfig', () => ({
  API_ENDPOINTS: { SIGNALR: { PARTY_HUB: '/partyHub' } },
  getSignalRUrl: (path: string) => `http://localhost:5000${path}`,
}));

vi.mock('../utils/logger', () => ({
  devLog: vi.fn(),
}));

describe('signalRService.onPartyDisplayStatusChanged', () => {
  beforeEach(() => {
    mockOn.mockClear();
    mockOff.mockClear();
    mockStart.mockClear();
    vi.resetModules();
  });

  it('registers OnPartyDisplayStatusChanged and forwards snake_case status to callback', async () => {
    const { signalRService } = await import('./signalRService');

    const callback = vi.fn();
    signalRService.onPartyDisplayStatusChanged(callback);

    await signalRService.connect();

    expect(mockOn).toHaveBeenCalledWith('OnPartyDisplayStatusChanged', expect.any(Function));

    const handler = mockOn.mock.calls.find(
      ([eventName]) => eventName === 'OnPartyDisplayStatusChanged',
    )?.[1];
    expect(handler).toBeTypeOf('function');

    handler?.('party-42', 'organizer_offline');

    expect(callback).toHaveBeenCalledOnce();
    expect(callback).toHaveBeenCalledWith('party-42', 'organizer_offline');
  });

  it('forwards live and party_ended snake_case statuses', async () => {
    const { signalRService } = await import('./signalRService');

    const callback = vi.fn();
    signalRService.onPartyDisplayStatusChanged(callback);
    await signalRService.connect();

    const handler = mockOn.mock.calls.find(
      ([eventName]) => eventName === 'OnPartyDisplayStatusChanged',
    )?.[1];

    handler?.('party-99', 'live');
    handler?.('party-99', 'party_ended');

    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback).toHaveBeenNthCalledWith(1, 'party-99', 'live');
    expect(callback).toHaveBeenNthCalledWith(2, 'party-99', 'party_ended');
  });
});
