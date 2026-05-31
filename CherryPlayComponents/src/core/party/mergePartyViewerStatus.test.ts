import { describe, expect, it } from 'vitest';

import type { PartyPlaylistData, PlaybackState } from '../../types';

import { mergePartyViewerStatus } from './mergePartyViewerStatus';

const basePlayback: PlaybackState = {
  currentTrackId: null,
  status: 'idle',
  position: 0,
  duration: 100,
  volume: 1,
  mode: 'session',
  playedTrackIds: ['t1'],
  disabledTrackIds: [],
  disabledGroupIds: [],
  lastUpdatedAt: '2026-01-01T00:00:00.000Z',
};

const endedProgramPlaylist: PartyPlaylistData = {
  items: [
    {
      id: 't1',
      type: 'track',
      name: 'Track 1',
      displayOrder: 0,
      level: 0,
    },
  ],
  totalDuration: 100,
  totalTracks: 1,
};

const connectedReachable = {
  connectionStatus: 'connected' as const,
  apiReachable: true,
};

describe('mergePartyViewerStatus', () => {
  it('returns party_ended when serverStatus is party_ended', () => {
    const result = mergePartyViewerStatus({
      serverStatus: 'party_ended',
      ...connectedReachable,
    });

    expect(result.id).toBe('party_ended');
    expect(result.label).toBe('Вечеринка окончена');
  });

  it('prefers party_ended over program_ended and unreachable overlays', () => {
    const result = mergePartyViewerStatus({
      serverStatus: 'party_ended',
      connectionStatus: 'disconnected',
      apiReachable: false,
      playlist: endedProgramPlaylist,
      playbackState: basePlayback,
    });

    expect(result.id).toBe('party_ended');
  });

  it('returns program_ended when the playlist program has ended', () => {
    const result = mergePartyViewerStatus({
      serverStatus: 'live',
      ...connectedReachable,
      playlist: endedProgramPlaylist,
      playbackState: basePlayback,
    });

    expect(result.id).toBe('program_ended');
    expect(result.label).toBe('Конец программы');
  });

  it('returns server_unreachable when the API is not reachable', () => {
    const result = mergePartyViewerStatus({
      serverStatus: 'live',
      connectionStatus: 'connected',
      apiReachable: false,
    });

    expect(result.id).toBe('server_unreachable');
  });

  it('returns server_unreachable when SignalR is disconnected', () => {
    const result = mergePartyViewerStatus({
      serverStatus: 'live',
      connectionStatus: 'disconnected',
      apiReachable: true,
    });

    expect(result.id).toBe('server_unreachable');
  });

  it('returns connecting when connecting without a server status', () => {
    const result = mergePartyViewerStatus({
      serverStatus: null,
      connectionStatus: 'connecting',
      apiReachable: true,
    });

    expect(result.id).toBe('connecting');
    expect(result.ariaLabel).toBe('Подключение к серверу');
  });

  it('maps a valid server display status when connected', () => {
    const result = mergePartyViewerStatus({
      serverStatus: 'live',
      ...connectedReachable,
    });

    expect(result.id).toBe('live');
    expect(result.label).toBe('Вечеринка идёт');
  });

  it('maps organizer_offline from the server', () => {
    const result = mergePartyViewerStatus({
      serverStatus: 'organizer_offline',
      ...connectedReachable,
    });

    expect(result.id).toBe('organizer_offline');
  });

  it('falls back to scheduled when connected with no server status', () => {
    const result = mergePartyViewerStatus({
      serverStatus: undefined,
      ...connectedReachable,
    });

    expect(result.id).toBe('scheduled');
    expect(result.label).toBe('Запланирована');
  });

  it('falls back to scheduled when serverStatus is not a valid display status id', () => {
    const result = mergePartyViewerStatus({
      serverStatus: 'not_a_real_status' as 'live',
      ...connectedReachable,
    });

    expect(result.id).toBe('scheduled');
  });
});
