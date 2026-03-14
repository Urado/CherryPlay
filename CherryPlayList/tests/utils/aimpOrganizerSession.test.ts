import { createInitialAimpBridgeState } from '../../src/shared/contracts/aimp';
import {
  startAimpOrganizerSession,
  teardownAimpOrganizerSession,
  type AimpOrganizerSessionActions,
} from '../../src/shared/utils/aimpOrganizerSession';

function createActions(
  overrides: Partial<AimpOrganizerSessionActions> = {},
): jest.Mocked<AimpOrganizerSessionActions> {
  return {
    startSession: jest.fn().mockResolvedValue(undefined),
    setLiveStreamStarted: jest.fn().mockResolvedValue(undefined),
    endSession: jest.fn().mockResolvedValue(undefined),
    resetPlaybackState: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function createReadyBridgeState() {
  const state = createInitialAimpBridgeState();
  state.sourceSelection = 'aimp';
  state.environment.eligible = true;
  state.environment.gatingReasons = [];
  state.connection.phase = 'connected';
  state.connection.appListening = true;
  state.connection.pluginConnected = true;
  state.pluginMetadata = {
    pluginName: 'CherryPlay AIMP Bridge',
    pluginVersion: '0.1.0',
    aimpVersion: '5.40.0',
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
    trackCount: 1,
    activeTrackKey: 'track-1',
    receivedAt: '2026-03-13T10:00:01.000Z',
    sentAt: '2026-03-13T10:00:01.000Z',
    tracks: [
      {
        trackKey: 'track-1',
        identityStrategy: 'nativeTrackId',
        nativeTrackId: 'track-1',
        title: 'Track One',
        durationMs: 120000,
        order: 0,
        isActive: true,
      },
    ],
  };
  state.playbackSnapshot = {
    revision: 1,
    status: 'playing',
    currentTrackKey: 'track-1',
    positionMs: 1000,
    durationMs: 120000,
    isMuted: false,
    volumePercent: 80,
    receivedAt: '2026-03-13T10:00:01.000Z',
    sentAt: '2026-03-13T10:00:01.000Z',
  };
  return state;
}

describe('aimpOrganizerSession', () => {
  test('blocks organizer startup until the publish path is ready', async () => {
    const actions = createActions();

    await expect(
      startAimpOrganizerSession({
        bridgeState: createReadyBridgeState(),
        publishingBridgeReady: false,
        actions,
      }),
    ).rejects.toThrow('AIMP publishing path is not ready yet.');

    expect(actions.startSession).not.toHaveBeenCalled();
    expect(actions.setLiveStreamStarted).not.toHaveBeenCalled();
  });

  test('starts SignalR session before committing liveStreamStarted', async () => {
    const actions = createActions();

    await startAimpOrganizerSession({
      bridgeState: createReadyBridgeState(),
      publishingBridgeReady: true,
      actions,
    });

    expect(actions.startSession).toHaveBeenCalledTimes(1);
    expect(actions.setLiveStreamStarted).toHaveBeenCalledWith(true);
    expect(actions.startSession.mock.invocationCallOrder[0]).toBeLessThan(
      actions.setLiveStreamStarted.mock.invocationCallOrder[0],
    );
  });

  test('rolls back the organizer session if the bridge flag update fails', async () => {
    const actions = createActions({
      setLiveStreamStarted: jest.fn().mockRejectedValue(new Error('bridge failed')),
    });

    await expect(
      startAimpOrganizerSession({
        bridgeState: createReadyBridgeState(),
        publishingBridgeReady: true,
        actions,
      }),
    ).rejects.toThrow('bridge failed');

    expect(actions.startSession).toHaveBeenCalledTimes(1);
    expect(actions.endSession).toHaveBeenCalledTimes(1);
    expect(actions.resetPlaybackState).toHaveBeenCalledTimes(1);
    expect(actions.disconnect).not.toHaveBeenCalled();
  });

  test('tears down the organizer session before disconnecting SignalR', async () => {
    const actions = createActions();

    await teardownAimpOrganizerSession({
      actions,
      shouldEndSession: true,
      shouldResetPlaybackState: true,
      shouldDisconnect: true,
    });

    expect(actions.endSession.mock.invocationCallOrder[0]).toBeLessThan(
      actions.resetPlaybackState.mock.invocationCallOrder[0],
    );
    expect(actions.resetPlaybackState.mock.invocationCallOrder[0]).toBeLessThan(
      actions.disconnect!.mock.invocationCallOrder[0],
    );
  });
});
