import { describe, expect, it, vi } from 'vitest';

import type { PartyStateDto } from '../types/api';

import {
  DISCONNECT_FREEZE_MS,
  applyOrganizerConnectionStatusChanged,
  resolveShowPlayerByStatus,
} from './partyViewReconnect';
import { playlistDataFromDto } from './playlistDataFromDto';

describe('applyOrganizerConnectionStatusChanged', () => {
  it('starts freeze timer when organizer goes offline', () => {
    vi.useFakeTimers();
    const clearSessionTimers = vi.fn();
    const setIsSessionActive = vi.fn();
    const setIsDisconnectFreezeActive = vi.fn();
    const setPlaybackState = vi.fn();
    const clearOfflineTimers = vi.fn();
    const scheduled: { callback?: () => void } = {};
    let scheduledMs = 0;

    applyOrganizerConnectionStatusChanged({
      isOnline: false,
      clearSessionTimers,
      setIsSessionActive,
      setIsDisconnectFreezeActive,
      setPlaybackState,
      clearOfflineTimers,
      scheduleDisconnectFreeze: (fn, ms) => {
        scheduled.callback = fn;
        scheduledMs = ms;
      },
    });

    expect(clearOfflineTimers).toHaveBeenCalledOnce();
    expect(setIsSessionActive).toHaveBeenCalledWith(false);
    expect(setIsDisconnectFreezeActive).toHaveBeenCalledWith(true);
    expect(scheduled.callback).toBeTypeOf('function');
    expect(scheduledMs).toBe(DISCONNECT_FREEZE_MS);

    scheduled.callback?.();
    expect(setPlaybackState).toHaveBeenCalledWith(null);
    expect(setIsDisconnectFreezeActive).toHaveBeenCalledWith(false);
    vi.useRealTimers();
  });

  it('clears freeze and requests full state when organizer comes online', () => {
    const clearSessionTimers = vi.fn();
    const setIsDisconnectFreezeActive = vi.fn();
    const onOrganizerOnline = vi.fn();

    applyOrganizerConnectionStatusChanged({
      isOnline: true,
      clearSessionTimers,
      setIsSessionActive: vi.fn(),
      setIsDisconnectFreezeActive,
      setPlaybackState: vi.fn(),
      clearOfflineTimers: vi.fn(),
      scheduleDisconnectFreeze: vi.fn(),
      onOrganizerOnline,
    });

    expect(clearSessionTimers).toHaveBeenCalledOnce();
    expect(setIsDisconnectFreezeActive).toHaveBeenCalledWith(false);
    expect(onOrganizerOnline).toHaveBeenCalledOnce();
  });

  it('uses 60s freeze window constant', () => {
    expect(DISCONNECT_FREEZE_MS).toBe(60_000);
  });
});

describe('resolveShowPlayerByStatus', () => {
  const playback = {
    currentTrackId: 't1',
    status: 'playing' as const,
    position: 1,
    duration: 10,
    volume: 0.8,
    mode: 'session' as const,
    playedTrackIds: [],
    disabledTrackIds: [],
    disabledGroupIds: [],
    lastUpdatedAt: '2026-01-01T00:00:00.000Z',
  };

  it('hides now-playing on server_unreachable even with cached playback', () => {
    expect(
      resolveShowPlayerByStatus({
        viewerStatusId: 'server_unreachable',
        isDisconnectFreezeActive: false,
        playbackState: playback,
      }),
    ).toBe(false);
  });

  it('hides now-playing on server_unreachable even during disconnect freeze', () => {
    expect(
      resolveShowPlayerByStatus({
        viewerStatusId: 'server_unreachable',
        isDisconnectFreezeActive: true,
        playbackState: playback,
      }),
    ).toBe(false);
  });

  it('keeps now-playing during disconnect freeze', () => {
    expect(
      resolveShowPlayerByStatus({
        viewerStatusId: 'organizer_offline',
        isDisconnectFreezeActive: true,
        playbackState: playback,
      }),
    ).toBe(true);
  });

  it('shows now-playing for live and program_ended', () => {
    expect(
      resolveShowPlayerByStatus({
        viewerStatusId: 'live',
        isDisconnectFreezeActive: false,
        playbackState: playback,
      }),
    ).toBe(true);
    expect(
      resolveShowPlayerByStatus({
        viewerStatusId: 'program_ended',
        isDisconnectFreezeActive: false,
        playbackState: null,
      }),
    ).toBe(true);
  });

  it('hides now-playing for connecting without freeze', () => {
    expect(
      resolveShowPlayerByStatus({
        viewerStatusId: 'connecting',
        isDisconnectFreezeActive: false,
        playbackState: playback,
      }),
    ).toBe(false);
  });

  it('shows now-playing for connecting only during disconnect freeze with playback', () => {
    expect(
      resolveShowPlayerByStatus({
        viewerStatusId: 'connecting',
        isDisconnectFreezeActive: true,
        playbackState: playback,
      }),
    ).toBe(true);
    expect(
      resolveShowPlayerByStatus({
        viewerStatusId: 'connecting',
        isDisconnectFreezeActive: true,
        playbackState: null,
      }),
    ).toBe(false);
  });
});

describe('playlistDataFromDto / full state playlist apply', () => {
  it('applies playlist from PartyStateDto', () => {
    const state: PartyStateDto = {
      partyId: 'p1',
      isSessionActive: true,
      partyDisplayStatus: 'live',
      playlist: {
        items: [
          {
            id: 'b',
            type: 'track',
            name: 'B',
            displayOrder: 2,
            duration: 20,
            level: 0,
          },
          {
            id: 'a',
            type: 'track',
            name: 'A',
            displayOrder: 1,
            duration: 10,
            level: 0,
          },
        ],
        totalDuration: 30,
        totalTracks: 2,
      },
    };

    const applied = playlistDataFromDto(state.playlist);
    expect(applied.totalTracks).toBe(2);
    expect(applied.items.map((item) => item.id)).toEqual(['a', 'b']);
  });
});
