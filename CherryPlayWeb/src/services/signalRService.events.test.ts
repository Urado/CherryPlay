import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PlaybackStateDto } from '../types/api';

const mockOn = vi.fn();
const mockOff = vi.fn();
const mockStart = vi.fn().mockResolvedValue(undefined);
const mockInvoke = vi.fn().mockResolvedValue(null);
const mockConnection = {
  on: mockOn,
  off: mockOff,
  start: mockStart,
  stop: vi.fn().mockResolvedValue(undefined),
  invoke: mockInvoke,
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

const samplePlaybackState: PlaybackStateDto = {
  currentTrackId: 'track-1',
  status: 'playing',
  position: 12.5,
  duration: 180,
  volume: 0.8,
  mode: 'session',
  playedTrackIds: [],
  disabledTrackIds: [],
  disabledGroupIds: [],
  lastUpdatedAt: '2026-01-01T00:00:00.000Z',
};

function getHandler(eventName: string): ((...args: unknown[]) => void) | undefined {
  return mockOn.mock.calls.find(([name]) => name === eventName)?.[1];
}

describe('signalRService hub event handlers', () => {
  beforeEach(() => {
    mockOn.mockClear();
    mockOff.mockClear();
    mockStart.mockClear();
    mockInvoke.mockClear();
    vi.resetModules();
  });

  it('registers OnSessionStarted and forwards partyId', async () => {
    const { signalRService } = await import('./signalRService');
    const callback = vi.fn();
    signalRService.onSessionStarted(callback);
    await signalRService.connect();

    getHandler('OnSessionStarted')?.('party-1');
    expect(callback).toHaveBeenCalledWith('party-1');
  });

  it('registers OnSessionEnded and forwards partyId', async () => {
    const { signalRService } = await import('./signalRService');
    const callback = vi.fn();
    signalRService.onSessionEnded(callback);
    await signalRService.connect();

    getHandler('OnSessionEnded')?.('party-2');
    expect(callback).toHaveBeenCalledWith('party-2');
  });

  it('registers OnFullStateUpdated and forwards partyId and playback state', async () => {
    const { signalRService } = await import('./signalRService');
    const callback = vi.fn();
    signalRService.onFullStateUpdated(callback);
    await signalRService.connect();

    getHandler('OnFullStateUpdated')?.('party-3', samplePlaybackState);
    expect(callback).toHaveBeenCalledWith('party-3', samplePlaybackState);
  });

  it('registers OnPlaybackPositionUpdated and forwards position args', async () => {
    const { signalRService } = await import('./signalRService');
    const callback = vi.fn();
    signalRService.onPlaybackPositionUpdated(callback);
    await signalRService.connect();

    getHandler('OnPlaybackPositionUpdated')?.('party-4', 'track-9', 42.5);
    expect(callback).toHaveBeenCalledWith('party-4', 'track-9', 42.5);
  });

  it('registers OnStateChanged and forwards partyId', async () => {
    const { signalRService } = await import('./signalRService');
    const callback = vi.fn();
    signalRService.onStateChanged(callback);
    await signalRService.connect();

    getHandler('OnStateChanged')?.('party-5');
    expect(callback).toHaveBeenCalledWith('party-5');
  });

  it('registers OnPlaylistChanged and forwards partyId', async () => {
    const { signalRService } = await import('./signalRService');
    const callback = vi.fn();
    signalRService.onPlaylistChanged(callback);
    await signalRService.connect();

    getHandler('OnPlaylistChanged')?.('party-6');
    expect(callback).toHaveBeenCalledWith('party-6');
  });

  it('registers OnConnectionStatusChanged and forwards online flag', async () => {
    const { signalRService } = await import('./signalRService');
    const callback = vi.fn();
    signalRService.onConnectionStatusChanged(callback);
    await signalRService.connect();

    getHandler('OnConnectionStatusChanged')?.('party-7', true);
    getHandler('OnConnectionStatusChanged')?.('party-7', false);
    expect(callback).toHaveBeenNthCalledWith(1, 'party-7', true);
    expect(callback).toHaveBeenNthCalledWith(2, 'party-7', false);
  });

  it('registers PlaybackStateReset and forwards partyId', async () => {
    const { signalRService } = await import('./signalRService');
    const callback = vi.fn();
    signalRService.onPlaybackStateReset(callback);
    await signalRService.connect();

    getHandler('PlaybackStateReset')?.('party-8');
    expect(callback).toHaveBeenCalledWith('party-8');
  });

  it('registers Error and forwards error message', async () => {
    const { signalRService } = await import('./signalRService');
    const callback = vi.fn();
    signalRService.onError(callback);
    await signalRService.connect();

    getHandler('Error')?.('Authentication required');
    expect(callback).toHaveBeenCalledWith('Authentication required');
  });

  it('requestFullState invokes RequestFullState hub method', async () => {
    const { signalRService } = await import('./signalRService');
    const state = {
      partyId: 'party-9',
      isSessionActive: true,
      partyDisplayStatus: 'live',
      playlist: { items: [], totalDuration: 0, totalTracks: 0 },
    };
    mockInvoke.mockResolvedValueOnce(state);

    await signalRService.connect();
    const result = await signalRService.requestFullState('abc123');

    expect(mockInvoke).toHaveBeenCalledWith('RequestFullState', 'abc123');
    expect(result).toEqual(state);
  });

  it('off removes registered handler from connection', async () => {
    const { signalRService } = await import('./signalRService');
    signalRService.onSessionStarted(vi.fn());
    await signalRService.connect();

    signalRService.off('OnSessionStarted');
    expect(mockOff).toHaveBeenCalledWith('OnSessionStarted');
  });
});
