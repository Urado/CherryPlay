import { createInitialAimpBridgeState } from '../../src/shared/contracts/aimp';
import {
  canStartAimpLiveStream,
  convertAimpPlaylistForApi,
  createAimpPlaybackStateDto,
  getAimpAvailability,
  getAimpEffectiveProgressMs,
} from '../../src/shared/utils/aimpStreamingAdapter';

describe('aimpStreamingAdapter', () => {
  test('ignores sourceNotAimp when evaluating renderer-side availability', () => {
    const state = createInitialAimpBridgeState();

    expect(getAimpAvailability(state)).toEqual({
      available: true,
      gatingReasons: [],
    });
  });

  test('converts AIMP playlist snapshots into the existing party playlist contract', () => {
    const state = createInitialAimpBridgeState();
    state.playlistSnapshot = {
      playlistId: 'playlist-1',
      playlistName: 'Main Playlist',
      revision: 3,
      trackCount: 2,
      activeTrackKey: 'native:track-2',
      receivedAt: '2026-03-13T10:00:01.000Z',
      sentAt: '2026-03-13T10:00:01.000Z',
      tracks: [
        {
          trackKey: 'native:track-1',
          identityStrategy: 'nativeTrackId',
          nativeTrackId: 'track-1',
          title: 'Intro',
          artist: 'Artist One',
          durationMs: 90000,
          order: 0,
          isActive: false,
        },
        {
          trackKey: 'native:track-2',
          identityStrategy: 'nativeTrackId',
          nativeTrackId: 'track-2',
          title: 'Main Theme',
          durationMs: 182000,
          order: 1,
          isActive: true,
        },
      ],
    };

    expect(convertAimpPlaylistForApi(state.playlistSnapshot)).toEqual({
      items: [
        {
          id: 'native:track-1',
          type: 'track',
          name: 'Artist One - Intro',
          duration: 90,
          displayOrder: 0,
          level: 0,
        },
        {
          id: 'native:track-2',
          type: 'track',
          name: 'Main Theme',
          duration: 182,
          displayOrder: 1,
          level: 0,
        },
      ],
      totalTracks: 2,
      totalDuration: 272,
    });
  });

  test('freezes extrapolated AIMP progress when the connection is no longer healthy', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-13T10:00:10.000Z'));

    const state = createInitialAimpBridgeState();
    state.connection.phase = 'connected';
    state.playbackSnapshot = {
      revision: 1,
      status: 'playing',
      currentTrackKey: 'native:track-1',
      positionMs: 20000,
      durationMs: 60000,
      isMuted: false,
      receivedAt: '2026-03-13T10:00:05.000Z',
      sentAt: '2026-03-13T10:00:05.000Z',
    };

    expect(getAimpEffectiveProgressMs(state, Date.now())).toBe(25000);

    state.connection.phase = 'stale';
    expect(getAimpEffectiveProgressMs(state, Date.now())).toBe(20000);

    jest.useRealTimers();
  });

  test('maps connected AIMP state into the existing PlaybackStateDto contract', () => {
    const state = createInitialAimpBridgeState();
    state.sourceSelection = 'aimp';
    state.environment.eligible = true;
    state.environment.gatingReasons = [];
    state.connection.phase = 'connected';
    state.connection.appListening = true;
    state.connection.pluginConnected = true;
    state.liveStreamStarted = true;
    state.pluginMetadata = {
      pluginName: 'CherryPlay AIMP Bridge',
      pluginVersion: '0.1.0',
      aimpVersion: '5.40.2683',
      protocolVersion: state.protocolVersion,
      architecture: 'x64',
      platform: 'win32',
      instanceId: 'instance-1',
      connectedAt: '2026-03-13T10:00:00.000Z',
      lastHelloAt: '2026-03-13T10:00:00.000Z',
    };
    state.playlistSnapshot = {
      playlistId: 'playlist-1',
      playlistName: 'Main Playlist',
      revision: 1,
      trackCount: 2,
      activeTrackKey: 'native:track-2',
      receivedAt: '2026-03-13T10:00:01.000Z',
      sentAt: '2026-03-13T10:00:01.000Z',
      tracks: [
        {
          trackKey: 'native:track-1',
          identityStrategy: 'nativeTrackId',
          nativeTrackId: 'track-1',
          title: 'Intro',
          durationMs: 90000,
          order: 0,
          isActive: false,
        },
        {
          trackKey: 'native:track-2',
          identityStrategy: 'nativeTrackId',
          nativeTrackId: 'track-2',
          title: 'Main Theme',
          durationMs: 182000,
          order: 1,
          isActive: true,
        },
      ],
    };
    state.playbackSnapshot = {
      revision: 2,
      status: 'playing',
      currentTrackKey: 'native:track-2',
      positionMs: 42000,
      durationMs: 182000,
      volumePercent: 78,
      isMuted: false,
      receivedAt: '2026-03-13T10:00:02.000Z',
      sentAt: '2026-03-13T10:00:02.000Z',
    };

    expect(canStartAimpLiveStream(state)).toBe(true);

    const playbackState = createAimpPlaybackStateDto(state, Date.parse('2026-03-13T10:00:02.000Z'));
    expect(playbackState).toMatchObject({
      currentTrackId: 'native:track-2',
      status: 'playing',
      position: 42,
      duration: 182,
      volume: 0.78,
      mode: 'session',
      playedTrackIds: ['native:track-1'],
      disabledTrackIds: [],
      disabledGroupIds: [],
    });
  });
});
