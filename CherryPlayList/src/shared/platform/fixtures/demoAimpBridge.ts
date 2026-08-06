import {
  AIMP_PROTOCOL_PIPE_NAME,
  AIMP_PROTOCOL_VERSION,
  createAimpCompatibilityCheckpointInput,
  createInitialAimpBridgeState,
  type AimpBridgeState,
  type AimpSourceSelection,
} from '../../contracts/aimp';

const DEMO_CONNECTED_AT = '2026-01-01T12:00:00.000Z';
const DEMO_PLAYLIST_RECEIVED_AT = '2026-01-01T12:00:01.000Z';
const DEMO_PLAYBACK_RECEIVED_AT = '2026-01-01T12:00:02.000Z';

function createDemoAimpConnectedState(
  sourceSelection: AimpSourceSelection,
  liveStreamStarted: boolean,
): AimpBridgeState {
  const base = createInitialAimpBridgeState();

  const state: AimpBridgeState = {
    ...base,
    sourceSelection,
    liveStreamStarted,
    environment: {
      eligible: true,
      pipeName: AIMP_PROTOCOL_PIPE_NAME,
      platform: 'win32',
      architecture: 'x64',
      gatingReasons: [],
    },
    connection: {
      ...base.connection,
      phase: 'connected',
      appListening: true,
      pluginConnected: true,
      lastMessageAt: DEMO_PLAYBACK_RECEIVED_AT,
      lastHeartbeatAt: DEMO_PLAYBACK_RECEIVED_AT,
      disconnectReason: null,
      protocolError: null,
    },
    pluginMetadata: {
      pluginName: 'CherryPlay AIMP Bridge (demo)',
      pluginVersion: 'demo',
      aimpVersion: '5.40 demo',
      protocolVersion: AIMP_PROTOCOL_VERSION,
      architecture: 'x64',
      platform: 'win32',
      instanceId: 'demo-aimp-instance',
      connectedAt: DEMO_CONNECTED_AT,
      lastHelloAt: DEMO_CONNECTED_AT,
    },
    playlistSnapshot: {
      playlistId: 'demo-playlist',
      playlistName: 'Demo AIMP Playlist',
      revision: 1,
      trackCount: 3,
      activeTrackKey: 'demo:track-2',
      receivedAt: DEMO_PLAYLIST_RECEIVED_AT,
      sentAt: DEMO_PLAYLIST_RECEIVED_AT,
      tracks: [
        {
          trackKey: 'demo:track-1',
          identityStrategy: 'nativeTrackId',
          nativeTrackId: 'track-1',
          title: 'Opening',
          artist: 'Demo Artist',
          durationMs: 180000,
          order: 0,
          isActive: false,
        },
        {
          trackKey: 'demo:track-2',
          identityStrategy: 'nativeTrackId',
          nativeTrackId: 'track-2',
          title: 'Party Mix',
          artist: 'Demo Artist',
          durationMs: 240000,
          order: 1,
          isActive: true,
        },
        {
          trackKey: 'demo:track-3',
          identityStrategy: 'nativeTrackId',
          nativeTrackId: 'track-3',
          title: 'Closing',
          artist: 'Demo Artist',
          durationMs: 150000,
          order: 2,
          isActive: false,
        },
      ],
    },
    playbackSnapshot: {
      revision: 1,
      status: 'playing',
      currentTrackKey: 'demo:track-2',
      positionMs: 65000,
      durationMs: 240000,
      volumePercent: 80,
      isMuted: false,
      receivedAt: DEMO_PLAYBACK_RECEIVED_AT,
      sentAt: DEMO_PLAYBACK_RECEIVED_AT,
    },
  };

  state.compatibilityCheckpointInput = createAimpCompatibilityCheckpointInput(state);
  return state;
}

/** Simulated AIMP bridge for web demo — no named pipe, fixture playlist/playback. */
export function createDemoAimpBridgeState(
  sourceSelection: AimpSourceSelection,
  liveStreamStarted = false,
): AimpBridgeState {
  if (sourceSelection !== 'aimp') {
    const state = createInitialAimpBridgeState();
    return {
      ...state,
      sourceSelection,
      liveStreamStarted: false,
      compatibilityCheckpointInput: createAimpCompatibilityCheckpointInput({
        ...state,
        sourceSelection,
        liveStreamStarted: false,
      }),
    };
  }

  return createDemoAimpConnectedState(sourceSelection, liveStreamStarted);
}
