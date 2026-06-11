/**
 * @vitest-environment jsdom
 */
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { PartyDisplayStatusId } from '../types/api';

const mockOnPartyDisplayStatusChanged = vi.fn();
const mockOff = vi.fn();
const mockIsServiceConnected = vi.fn().mockReturnValue(false);

vi.mock('../services/signalRService', () => ({
  signalRService: {
    onPartyDisplayStatusChanged: mockOnPartyDisplayStatusChanged,
    off: mockOff,
    isServiceConnected: mockIsServiceConnected,
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    joinPartyAsViewer: vi.fn().mockResolvedValue(undefined),
    requestFullState: vi.fn().mockResolvedValue(null),
    onSessionStarted: vi.fn(),
    onSessionEnded: vi.fn(),
    onPlaybackPositionUpdated: vi.fn(),
    onFullStateUpdated: vi.fn(),
    onStateChanged: vi.fn(),
    onPlaylistChanged: vi.fn(),
    onConnectionStatusChanged: vi.fn(),
    onError: vi.fn(),
  },
}));

describe('useSignalR onPartyDisplayStatusChanged wiring', () => {
  let registeredHandler:
    | ((partyId: string, partyDisplayStatus: PartyDisplayStatusId) => void)
    | undefined;

  beforeEach(() => {
    registeredHandler = undefined;
    mockOnPartyDisplayStatusChanged.mockReset();
    mockOff.mockReset();
    mockIsServiceConnected.mockReset();
    mockIsServiceConnected.mockReturnValue(false);
    mockOnPartyDisplayStatusChanged.mockImplementation((handler) => {
      registeredHandler = handler;
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  it('registers onPartyDisplayStatusChanged and forwards live and organizer_offline', async () => {
    const onPartyDisplayStatusChanged = vi.fn();
    const { useSignalR } = await import('./useSignalR');

    renderHook(() =>
      useSignalR({
        onPartyDisplayStatusChanged,
      }),
    );

    await waitFor(() => {
      expect(mockOnPartyDisplayStatusChanged).toHaveBeenCalledOnce();
    });

    registeredHandler?.('party-42', 'live');
    registeredHandler?.('party-42', 'organizer_offline');

    expect(onPartyDisplayStatusChanged).toHaveBeenCalledTimes(2);
    expect(onPartyDisplayStatusChanged).toHaveBeenNthCalledWith(1, 'party-42', 'live');
    expect(onPartyDisplayStatusChanged).toHaveBeenNthCalledWith(2, 'party-42', 'organizer_offline');
  });

  it('calls signalRService.off on unmount when callback was provided', async () => {
    const onPartyDisplayStatusChanged = vi.fn();
    const { useSignalR } = await import('./useSignalR');

    const { unmount } = renderHook(() =>
      useSignalR({
        onPartyDisplayStatusChanged,
      }),
    );

    await waitFor(() => {
      expect(mockOnPartyDisplayStatusChanged).toHaveBeenCalledOnce();
    });

    unmount();

    expect(mockOff).toHaveBeenCalledWith('OnPartyDisplayStatusChanged');
  });

  it('calls signalRService.off when callback prop is removed', async () => {
    const onPartyDisplayStatusChanged = vi.fn();
    const { useSignalR } = await import('./useSignalR');

    type DisplayStatusCallback = (
      partyId: string,
      partyDisplayStatus: PartyDisplayStatusId,
    ) => void;

    const { rerender } = renderHook<
      ReturnType<typeof useSignalR>,
      { callback?: DisplayStatusCallback }
    >(
      ({ callback }) =>
        useSignalR({
          onPartyDisplayStatusChanged: callback,
        }),
      {
        initialProps: {
          callback: onPartyDisplayStatusChanged as DisplayStatusCallback,
        },
      },
    );

    await waitFor(() => {
      expect(mockOnPartyDisplayStatusChanged).toHaveBeenCalledOnce();
    });

    mockOff.mockClear();

    rerender({ callback: undefined });

    await waitFor(() => {
      expect(mockOff).toHaveBeenCalledWith('OnPartyDisplayStatusChanged');
    });
  });
});
