import {
  AIMP_PROTOCOL_PIPE_NAME,
  AIMP_PROTOCOL_VERSION,
  createAimpCompatibilityCheckpointInput,
  createInitialAimpBridgeState,
  type AimpBridgeState,
  type AimpSourceSelection,
} from '../../contracts/aimp';
import type { DemoAimpPlaylistSize } from '../types';

const DEMO_PLAYLIST_COUNTS: Record<DemoAimpPlaylistSize, number> = {
  small: 3,
  medium: 25,
  large: 100,
};

const DEMO_TRACK_TEMPLATES = [
  { title: 'Opening', artist: 'Demo Artist', durationMs: 180000 },
  { title: 'Party Mix', artist: 'Demo Artist', durationMs: 240000 },
  { title: 'Closing', artist: 'Demo Artist', durationMs: 150000 },
  { title: 'Night Drive', artist: 'Cherry Ensemble', durationMs: 213000 },
  { title: 'Electric Bloom', artist: 'The Demo Band', durationMs: 197000 },
];

const createDemoAimpConnectedState = (
  sourceSelection: AimpSourceSelection,
  liveStreamStarted: boolean,
  playlistSize: DemoAimpPlaylistSize,
): AimpBridgeState => {
  const base = createInitialAimpBridgeState();
  const now = Date.now();
  const connectedAt = new Date(now).toISOString();
  const playlistReceivedAt = new Date(now).toISOString();
  const playbackReceivedAt = new Date(now).toISOString();
  const trackCount = DEMO_PLAYLIST_COUNTS[playlistSize];
  const tracks = Array.from({ length: trackCount }, (_, index) => {
    const template = DEMO_TRACK_TEMPLATES[index % DEMO_TRACK_TEMPLATES.length];
    const trackNumber = String(index + 1).padStart(3, '0');

    return {
      trackKey: `demo:track-${index + 1}`,
      identityStrategy: 'nativeTrackId' as const,
      nativeTrackId: `track-${index + 1}`,
      title:
        index < DEMO_TRACK_TEMPLATES.length ? template.title : `${template.title} ${trackNumber}`,
      artist: template.artist,
      durationMs: template.durationMs,
      order: index,
      isActive: index === 1,
    };
  });
  const activeTrack = tracks[1];

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
      lastMessageAt: playbackReceivedAt,
      lastHeartbeatAt: playbackReceivedAt,
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
      connectedAt,
      lastHelloAt: connectedAt,
    },
    playlistSnapshot: {
      playlistId: 'demo-playlist',
      playlistName: 'Demo AIMP Playlist',
      revision: trackCount,
      trackCount,
      activeTrackKey: activeTrack.trackKey,
      receivedAt: playlistReceivedAt,
      sentAt: playlistReceivedAt,
      tracks,
    },
    playbackSnapshot: {
      revision: trackCount,
      status: 'playing',
      currentTrackKey: activeTrack.trackKey,
      positionMs: 65000,
      durationMs: activeTrack.durationMs,
      volumePercent: 80,
      isMuted: false,
      receivedAt: playbackReceivedAt,
      sentAt: playbackReceivedAt,
    },
  };

  state.compatibilityCheckpointInput = createAimpCompatibilityCheckpointInput(state);
  return state;
};

export const createDemoAimpBridgeState = (
  sourceSelection: AimpSourceSelection,
  liveStreamStarted = false,
  playlistSize: DemoAimpPlaylistSize = 'small',
): AimpBridgeState => {
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

  return createDemoAimpConnectedState(sourceSelection, liveStreamStarted, playlistSize);
};
