import { describe, expect, it, vi } from 'vitest';

import type { PartyDisplayStatusId, PlaybackStateDto } from '../types/api';

/**
 * Mirrors PartyView.onSessionEnded handler (~171–180): grace timer then clears playback.
 */
function applySessionEnded(params: {
  clearSessionTimers: () => void;
  setIsDisconnectFreezeActive: (v: boolean) => void;
  setPartyDisplayStatus: (s: PartyDisplayStatusId) => void;
  scheduleGrace: (fn: () => void, ms: number) => void;
  setPlaybackState: (s: null) => void;
  setIsSessionActive: (v: boolean) => void;
}): void {
  params.clearSessionTimers();
  params.setIsDisconnectFreezeActive(false);
  params.setPartyDisplayStatus('starting_soon');
  params.scheduleGrace(() => {
    params.setPlaybackState(null);
    params.setIsSessionActive(false);
  }, 5000);
}

/**
 * Mirrors PartyView handlePlaybackStateReset (~316–321).
 */
function applyPlaybackStateReset(params: {
  clearSessionTimers: () => void;
  setIsDisconnectFreezeActive: (v: boolean) => void;
  setPlaybackState: (s: null) => void;
  setIsSessionActive: (v: boolean) => void;
  setPartyDisplayStatus: (s: PartyDisplayStatusId) => void;
}): void {
  params.clearSessionTimers();
  params.setIsDisconnectFreezeActive(false);
  params.setPlaybackState(null);
  params.setIsSessionActive(false);
  params.setPartyDisplayStatus('starting_soon');
}

/**
 * Mirrors PartyView.onFullStateUpdated non-session branch (~224–227).
 */
function applyFullStateUpdated(
  state: PlaybackStateDto,
  setIsSessionActive: (v: boolean) => void,
  setPlaybackState: (s: null) => void,
): void {
  if (state.mode !== 'session') {
    setIsSessionActive(false);
    setPlaybackState(null);
  }
}

describe('PartyView SignalR handler contracts', () => {
  it('onSessionEnded sets starting_soon and schedules playback clear', () => {
    vi.useFakeTimers();
    const clearSessionTimers = vi.fn();
    const setIsDisconnectFreezeActive = vi.fn();
    const setPartyDisplayStatus = vi.fn();
    const setPlaybackState = vi.fn();
    const setIsSessionActive = vi.fn();

    applySessionEnded({
      clearSessionTimers,
      setIsDisconnectFreezeActive,
      setPartyDisplayStatus,
      scheduleGrace: (fn, ms) => setTimeout(fn, ms),
      setPlaybackState,
      setIsSessionActive,
    });

    expect(clearSessionTimers).toHaveBeenCalledOnce();
    expect(setIsDisconnectFreezeActive).toHaveBeenCalledWith(false);
    expect(setPartyDisplayStatus).toHaveBeenCalledWith('starting_soon');
    expect(setPlaybackState).not.toHaveBeenCalled();

    vi.advanceTimersByTime(5000);
    expect(setPlaybackState).toHaveBeenCalledWith(null);
    expect(setIsSessionActive).toHaveBeenCalledWith(false);
    vi.useRealTimers();
  });

  it('handlePlaybackStateReset clears session and sets starting_soon', () => {
    const clearSessionTimers = vi.fn();
    const setIsDisconnectFreezeActive = vi.fn();
    const setPlaybackState = vi.fn();
    const setIsSessionActive = vi.fn();
    const setPartyDisplayStatus = vi.fn();

    applyPlaybackStateReset({
      clearSessionTimers,
      setIsDisconnectFreezeActive,
      setPlaybackState,
      setIsSessionActive,
      setPartyDisplayStatus,
    });

    expect(setPlaybackState).toHaveBeenCalledWith(null);
    expect(setIsSessionActive).toHaveBeenCalledWith(false);
    expect(setPartyDisplayStatus).toHaveBeenCalledWith('starting_soon');
  });

  it('onFullStateUpdated clears playback when mode is not session', () => {
    const setIsSessionActive = vi.fn();
    const setPlaybackState = vi.fn();

    applyFullStateUpdated(
      {
        currentTrackId: null,
        status: 'idle',
        position: 0,
        duration: 0,
        volume: 0.8,
        mode: 'preparation',
        playedTrackIds: [],
        disabledTrackIds: [],
        disabledGroupIds: [],
        lastUpdatedAt: '2026-01-01T00:00:00.000Z',
      },
      setIsSessionActive,
      setPlaybackState,
    );

    expect(setIsSessionActive).toHaveBeenCalledWith(false);
    expect(setPlaybackState).toHaveBeenCalledWith(null);
  });
});
