import { createInitialAimpBridgeState } from '../../src/shared/contracts/aimp';
import { detectAimpLiveProgramEnded } from '../../src/workspaces/party/detectAimpLiveProgramEnded';

describe('detectAimpLiveProgramEnded', () => {
  const nowMs = Date.parse('2026-08-11T12:00:00.000Z');

  function buildLiveEndedState() {
    const state = createInitialAimpBridgeState();
    state.liveStreamStarted = true;
    state.connection.phase = 'connected';
    state.playlistSnapshot = {
      playlistId: 'pl-1',
      playlistName: 'Main',
      revision: 1,
      trackCount: 2,
      activeTrackKey: 'native:track-2',
      receivedAt: '2026-08-11T11:59:50.000Z',
      sentAt: '2026-08-11T11:59:50.000Z',
      tracks: [
        {
          trackKey: 'native:track-1',
          identityStrategy: 'nativeTrackId',
          nativeTrackId: 'track-1',
          title: 'One',
          artist: 'A',
          durationMs: 60_000,
          order: 0,
          isActive: false,
        },
        {
          trackKey: 'native:track-2',
          identityStrategy: 'nativeTrackId',
          nativeTrackId: 'track-2',
          title: 'Two',
          artist: 'A',
          durationMs: 90_000,
          order: 1,
          isActive: true,
        },
      ],
    };
    state.playbackSnapshot = {
      status: 'stopped',
      currentTrackKey: 'native:track-2',
      positionMs: 89_500,
      durationMs: 90_000,
      volumePercent: 80,
      isMuted: false,
      receivedAt: '2026-08-11T11:59:59.000Z',
      sentAt: '2026-08-11T11:59:59.000Z',
    };
    return state;
  }

  it('returns false when live stream is not started', () => {
    const state = buildLiveEndedState();
    state.liveStreamStarted = false;
    expect(detectAimpLiveProgramEnded(state, nowMs)).toBe(false);
  });

  it('returns false while still playing', () => {
    const state = buildLiveEndedState();
    state.playbackSnapshot = {
      ...state.playbackSnapshot!,
      status: 'playing',
      positionMs: 10_000,
    };
    expect(detectAimpLiveProgramEnded(state, nowMs)).toBe(false);
  });

  it('returns false when stopped on a non-last track', () => {
    const state = buildLiveEndedState();
    state.playbackSnapshot = {
      ...state.playbackSnapshot!,
      currentTrackKey: 'native:track-1',
      positionMs: 59_500,
      durationMs: 60_000,
    };
    expect(detectAimpLiveProgramEnded(state, nowMs)).toBe(false);
  });

  it('returns true when stopped near the end of the last track', () => {
    expect(detectAimpLiveProgramEnded(buildLiveEndedState(), nowMs)).toBe(true);
  });

  it('returns false when last track duration is unknown', () => {
    const state = buildLiveEndedState();
    state.playbackSnapshot = {
      ...state.playbackSnapshot!,
      durationMs: undefined,
      positionMs: 89_500,
    };
    state.playlistSnapshot = {
      ...state.playlistSnapshot!,
      tracks: state.playlistSnapshot!.tracks.map((track) =>
        track.trackKey === 'native:track-2' ? { ...track, durationMs: undefined } : track,
      ),
    };
    expect(detectAimpLiveProgramEnded(state, nowMs)).toBe(false);
  });

  it('returns false when position reset to zero on last track stop', () => {
    const state = buildLiveEndedState();
    state.playbackSnapshot = {
      ...state.playbackSnapshot!,
      positionMs: 0,
    };
    expect(detectAimpLiveProgramEnded(state, nowMs)).toBe(false);
  });
});
