/**
 * @vitest-environment jsdom
 */
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PlaybackStateDto } from '../types/api';

const mockOnSessionStarted = vi.fn();
const mockOnSessionEnded = vi.fn();
const mockOnFullStateUpdated = vi.fn();
const mockOnConnectionStatusChanged = vi.fn();
const mockOnError = vi.fn();
const mockOff = vi.fn();
const mockIsServiceConnected = vi.fn().mockReturnValue(false);

vi.mock('../services/signalRService', () => ({
  signalRService: {
    onSessionStarted: mockOnSessionStarted,
    onSessionEnded: mockOnSessionEnded,
    onFullStateUpdated: mockOnFullStateUpdated,
    onConnectionStatusChanged: mockOnConnectionStatusChanged,
    onError: mockOnError,
    off: mockOff,
    isServiceConnected: mockIsServiceConnected,
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    joinPartyAsViewer: vi.fn().mockResolvedValue(undefined),
    requestFullState: vi.fn().mockResolvedValue(null),
    onPlaybackPositionUpdated: vi.fn(),
    onStateChanged: vi.fn(),
    onPlaylistChanged: vi.fn(),
    onPartyDisplayStatusChanged: vi.fn(),
  },
}));

const samplePlaybackState: PlaybackStateDto = {
  currentTrackId: 'track-1',
  status: 'playing',
  position: 0,
  duration: 120,
  volume: 0.8,
  mode: 'session',
  playedTrackIds: [],
  disabledTrackIds: [],
  disabledGroupIds: [],
  lastUpdatedAt: '2026-01-01T00:00:00.000Z',
};

describe('useSignalR hub event wiring', () => {
  const handlers: Record<string, (...args: unknown[]) => void> = {};

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsServiceConnected.mockReturnValue(false);
    for (const key of Object.keys(handlers)) {
      delete handlers[key];
    }

    mockOnSessionStarted.mockImplementation((handler) => {
      handlers.onSessionStarted = handler;
    });
    mockOnSessionEnded.mockImplementation((handler) => {
      handlers.onSessionEnded = handler;
    });
    mockOnFullStateUpdated.mockImplementation((handler) => {
      handlers.onFullStateUpdated = handler;
    });
    mockOnConnectionStatusChanged.mockImplementation((handler) => {
      handlers.onConnectionStatusChanged = handler;
    });
    mockOnError.mockImplementation((handler) => {
      handlers.onError = handler;
    });
  });

  it('forwards OnSessionStarted to callback', async () => {
    const onSessionStarted = vi.fn();
    const { useSignalR } = await import('./useSignalR');

    renderHook(() => useSignalR({ onSessionStarted }));

    await waitFor(() => expect(mockOnSessionStarted).toHaveBeenCalledOnce());
    handlers.onSessionStarted?.('party-1');
    expect(onSessionStarted).toHaveBeenCalledWith('party-1');
  });

  it('forwards OnSessionEnded to callback', async () => {
    const onSessionEnded = vi.fn();
    const { useSignalR } = await import('./useSignalR');

    renderHook(() => useSignalR({ onSessionEnded }));

    await waitFor(() => expect(mockOnSessionEnded).toHaveBeenCalledOnce());
    handlers.onSessionEnded?.('party-2');
    expect(onSessionEnded).toHaveBeenCalledWith('party-2');
  });

  it('forwards OnFullStateUpdated to callback', async () => {
    const onFullStateUpdated = vi.fn();
    const { useSignalR } = await import('./useSignalR');

    renderHook(() => useSignalR({ onFullStateUpdated }));

    await waitFor(() => expect(mockOnFullStateUpdated).toHaveBeenCalledOnce());
    handlers.onFullStateUpdated?.('party-3', samplePlaybackState);
    expect(onFullStateUpdated).toHaveBeenCalledWith('party-3', samplePlaybackState);
  });

  it('forwards OnConnectionStatusChanged to callback', async () => {
    const onConnectionStatusChanged = vi.fn();
    const { useSignalR } = await import('./useSignalR');

    renderHook(() => useSignalR({ onConnectionStatusChanged }));

    await waitFor(() => expect(mockOnConnectionStatusChanged).toHaveBeenCalledOnce());
    handlers.onConnectionStatusChanged?.('party-4', false);
    expect(onConnectionStatusChanged).toHaveBeenCalledWith('party-4', false);
  });

  it('forwards Error to callback', async () => {
    const onError = vi.fn();
    const { useSignalR } = await import('./useSignalR');

    renderHook(() => useSignalR({ onError }));

    await waitFor(() => expect(mockOnError).toHaveBeenCalledOnce());
    handlers.onError?.('Party not found');
    expect(onError).toHaveBeenCalledWith('Party not found');
  });

  it('calls off for session and connection handlers on unmount', async () => {
    const { useSignalR } = await import('./useSignalR');

    const { unmount } = renderHook(() =>
      useSignalR({
        onSessionStarted: vi.fn(),
        onSessionEnded: vi.fn(),
        onFullStateUpdated: vi.fn(),
        onConnectionStatusChanged: vi.fn(),
        onError: vi.fn(),
      }),
    );

    await waitFor(() => expect(mockOnSessionStarted).toHaveBeenCalledOnce());
    unmount();

    expect(mockOff).toHaveBeenCalledWith('OnSessionStarted');
    expect(mockOff).toHaveBeenCalledWith('OnSessionEnded');
    expect(mockOff).toHaveBeenCalledWith('OnFullStateUpdated');
    expect(mockOff).toHaveBeenCalledWith('OnConnectionStatusChanged');
    expect(mockOff).toHaveBeenCalledWith('Error');
  });
});
