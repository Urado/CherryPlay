import {
  AIMP_PROTOCOL_VERSION,
  createAimpHelloAckMessage,
  createAimpCompatibilityCheckpointInput,
  createInitialAimpBridgeState,
  normalizeAimpPlaybackSnapshot,
  normalizeAimpPlaylistSnapshot,
  normalizeAimpPluginMetadata,
  validateAimpBridgeState,
  validateAimpBridgeStateResponse,
  validateAimpLiveStreamPayload,
  validateAimpPluginManifest,
  validateAimpProtocolMessage,
  validateAimpServerProtocolMessage,
  validateAimpSourceSelectionPayload,
} from '../../src/shared/contracts/aimp';

describe('AIMP contract validation', () => {
  test('accepts a valid hello payload', () => {
    const result = validateAimpProtocolMessage({
      type: 'hello',
      protocolVersion: AIMP_PROTOCOL_VERSION,
      sequence: 1,
      messageId: 'hello-1',
      sentAt: '2026-03-13T10:00:00.000Z',
      payload: {
        pluginName: 'CherryPlay AIMP Bridge',
        pluginVersion: '0.1.0',
        aimpVersion: '5.40.2683',
        architecture: 'x64',
        platform: 'win32',
        instanceId: 'instance-1',
      },
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error(result.error.message);
    }

    expect(result.value.type).toBe('hello');
    expect(result.value.payload.instanceId).toBe('instance-1');
  });

  test('accepts both success and rejection helloAck server messages with explicit semantics', () => {
    const acceptedAck = createAimpHelloAckMessage({
      sequence: 1,
      accepted: true,
      sentAt: '2026-03-13T10:00:00.000Z',
      messageId: 'server-helloAck-1',
    });

    expect(validateAimpServerProtocolMessage(acceptedAck)).toEqual({
      success: true,
      value: acceptedAck,
    });

    const rejectedAck = createAimpHelloAckMessage({
      sequence: 2,
      accepted: false,
      sentAt: '2026-03-13T10:00:00.100Z',
      messageId: 'server-helloAck-2',
      errorCode: 'unsupportedProtocolVersion',
      detail: 'Unsupported AIMP protocol version "2.0.0" Supported versions: 1.0.0',
    });

    expect(validateAimpServerProtocolMessage(rejectedAck)).toEqual({
      success: true,
      value: rejectedAck,
    });
  });

  test('rejects helloAck rejections that omit an explicit errorCode', () => {
    const result = validateAimpServerProtocolMessage({
      type: 'helloAck',
      protocolVersion: AIMP_PROTOCOL_VERSION,
      sequence: 5,
      messageId: 'server-helloAck-invalid',
      sentAt: '2026-03-13T10:00:00.000Z',
      payload: {
        accepted: false,
        serverProtocolVersion: AIMP_PROTOCOL_VERSION,
      },
    });

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error('Expected invalid helloAck rejection to fail validation');
    }

    expect(result.error.code).toBe('invalidPayload');
    expect(result.error.message).toContain('must include an errorCode');
  });

  test('rejects unsupported protocol versions', () => {
    const result = validateAimpProtocolMessage({
      type: 'hello',
      protocolVersion: '2.0.0',
      sequence: 1,
      messageId: 'hello-unsupported',
      sentAt: '2026-03-13T10:00:00.000Z',
      payload: {
        pluginName: 'CherryPlay AIMP Bridge',
        pluginVersion: '0.2.0',
        aimpVersion: '5.40.2683',
        architecture: 'x64',
        platform: 'win32',
        instanceId: 'instance-2',
      },
    });

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error('Expected protocol version validation to fail');
    }

    expect(result.error.code).toBe('unsupportedProtocolVersion');
  });

  test('normalizes playlist and playback snapshots into renderer DTOs', () => {
    const playlistResult = validateAimpProtocolMessage({
      type: 'playlistSnapshot',
      protocolVersion: AIMP_PROTOCOL_VERSION,
      sequence: 2,
      messageId: 'playlist-1',
      sentAt: '2026-03-13T10:00:01.000Z',
      payload: {
        playlistId: 'main-playlist',
        playlistName: 'Main Playlist',
        revision: 5,
        activeTrack: {
          nativeTrackId: 'track-1',
        },
        tracks: [
          {
            nativeTrackId: 'track-1',
            filePath: 'C:\\Music\\Track1.mp3',
            title: 'Track 1',
            artist: 'Artist',
            durationMs: 120000,
            positionInQueue: 0,
            isActive: true,
          },
        ],
      },
    });

    expect(playlistResult.success).toBe(true);
    if (!playlistResult.success) {
      throw new Error(playlistResult.error.message);
    }

    const playlistDto = normalizeAimpPlaylistSnapshot(
      playlistResult.value,
      '2026-03-13T10:00:01.100Z',
    );

    expect(playlistDto.activeTrackKey).toBe('native:track-1');
    expect(playlistDto.trackCount).toBe(1);
    expect(playlistDto.tracks[0].identityStrategy).toBe('nativeTrackId');

    const playbackResult = validateAimpProtocolMessage({
      type: 'playbackSnapshot',
      protocolVersion: AIMP_PROTOCOL_VERSION,
      sequence: 3,
      messageId: 'playback-1',
      sentAt: '2026-03-13T10:00:02.000Z',
      payload: {
        revision: 7,
        status: 'playing',
        currentTrack: {
          nativeTrackId: 'track-1',
        },
        positionMs: 45000,
        durationMs: 120000,
        volumePercent: 75,
        isMuted: false,
      },
    });

    expect(playbackResult.success).toBe(true);
    if (!playbackResult.success) {
      throw new Error(playbackResult.error.message);
    }

    const playbackDto = normalizeAimpPlaybackSnapshot(
      playbackResult.value,
      '2026-03-13T10:00:02.100Z',
    );

    expect(playbackDto.currentTrackKey).toBe('native:track-1');
    expect(playbackDto.status).toBe('playing');
    expect(playbackDto.positionMs).toBe(45000);
  });

  test('validates the plugin manifest contract and initial bridge state', () => {
    const manifestResult = validateAimpPluginManifest({
      name: 'cherryplay-aimp-bridge',
      version: '0.1.0',
      protocolVersion: AIMP_PROTOCOL_VERSION,
      pipeName: '\\\\.\\pipe\\cherryplay-aimp-v1',
      supportedPlatforms: ['win32'],
      supportedArchitectures: ['x64'],
      main: 'CherryPlayAimpBridge.dll',
    });

    expect(manifestResult.success).toBe(true);

    const helloResult = validateAimpProtocolMessage({
      type: 'hello',
      protocolVersion: AIMP_PROTOCOL_VERSION,
      sequence: 1,
      messageId: 'hello-manifest',
      sentAt: '2026-03-13T10:00:00.000Z',
      payload: {
        pluginName: 'CherryPlay AIMP Bridge',
        pluginVersion: '0.1.0',
        aimpVersion: '5.40.2683',
        architecture: 'x64',
        platform: 'win32',
        instanceId: 'instance-3',
      },
    });

    expect(helloResult.success).toBe(true);
    if (!helloResult.success) {
      throw new Error(helloResult.error.message);
    }

    const pluginMetadata = normalizeAimpPluginMetadata(
      helloResult.value,
      '2026-03-13T10:00:00.100Z',
    );
    expect(pluginMetadata.protocolVersion).toBe(AIMP_PROTOCOL_VERSION);

    const initialState = createInitialAimpBridgeState();
    expect(initialState.sourceSelection).toBe('cherryPlayPlayer');
    expect(initialState.compatibilityCheckpointInput.source).toBe('AIMP');
  });

  test('rejects invalid optional field types instead of silently dropping them', () => {
    const result = validateAimpProtocolMessage({
      type: 'playbackSnapshot',
      protocolVersion: AIMP_PROTOCOL_VERSION,
      sequence: 9,
      messageId: 'playback-invalid-optional',
      sentAt: '2026-03-13T10:00:02.000Z',
      payload: {
        revision: 7,
        status: 'playing',
        positionMs: 45000,
        durationMs: 120000,
        volumePercent: '75',
        isMuted: false,
      },
    });

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error('Expected invalid optional field validation to fail');
    }

    expect(result.error.code).toBe('invalidPayload');
  });

  test('rejects mismatched central track references and legacy keys', () => {
    const result = validateAimpProtocolMessage({
      type: 'playbackSnapshot',
      protocolVersion: AIMP_PROTOCOL_VERSION,
      sequence: 10,
      messageId: 'playback-mismatch',
      sentAt: '2026-03-13T10:00:02.000Z',
      payload: {
        revision: 7,
        status: 'playing',
        currentTrack: {
          nativeTrackId: 'track-1',
        },
        currentTrackKey: 'native:track-2',
        positionMs: 45000,
      },
    });

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error('Expected mismatched track identity validation to fail');
    }

    expect(result.error.code).toBe('invalidPayload');
  });

  test('rejects playlist snapshots whose activeTrack does not belong to tracks', () => {
    const result = validateAimpProtocolMessage({
      type: 'playlistSnapshot',
      protocolVersion: AIMP_PROTOCOL_VERSION,
      sequence: 11,
      messageId: 'playlist-active-track-missing',
      sentAt: '2026-03-13T10:00:02.000Z',
      payload: {
        playlistId: 'main-playlist',
        playlistName: 'Main Playlist',
        revision: 8,
        activeTrack: {
          nativeTrackId: 'missing-track',
        },
        tracks: [
          {
            nativeTrackId: 'track-1',
            title: 'Track 1',
            durationMs: 120000,
            positionInQueue: 0,
            isActive: true,
          },
        ],
      },
    });

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error('Expected missing active track membership validation to fail');
    }

    expect(result.error.code).toBe('invalidPayload');
  });

  test('rejects playlist snapshots with multiple active track flags', () => {
    const result = validateAimpProtocolMessage({
      type: 'playlistSnapshot',
      protocolVersion: AIMP_PROTOCOL_VERSION,
      sequence: 12,
      messageId: 'playlist-multiple-active-flags',
      sentAt: '2026-03-13T10:00:02.000Z',
      payload: {
        playlistId: 'main-playlist',
        playlistName: 'Main Playlist',
        revision: 9,
        tracks: [
          {
            nativeTrackId: 'track-1',
            title: 'Track 1',
            durationMs: 120000,
            positionInQueue: 0,
            isActive: true,
          },
          {
            nativeTrackId: 'track-2',
            title: 'Track 2',
            durationMs: 121000,
            positionInQueue: 1,
            isActive: true,
          },
        ],
      },
    });

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error('Expected multiple active track flag validation to fail');
    }

    expect(result.error.code).toBe('invalidPayload');
  });

  test('rejects playlist snapshots when activeTrack membership disagrees with track flags', () => {
    const result = validateAimpProtocolMessage({
      type: 'playlistSnapshot',
      protocolVersion: AIMP_PROTOCOL_VERSION,
      sequence: 13,
      messageId: 'playlist-active-track-membership-mismatch',
      sentAt: '2026-03-13T10:00:02.000Z',
      payload: {
        playlistId: 'main-playlist',
        playlistName: 'Main Playlist',
        revision: 10,
        activeTrack: {
          nativeTrackId: 'track-2',
        },
        tracks: [
          {
            nativeTrackId: 'track-1',
            title: 'Track 1',
            durationMs: 120000,
            positionInQueue: 0,
            isActive: true,
          },
          {
            nativeTrackId: 'track-2',
            title: 'Track 2',
            durationMs: 121000,
            positionInQueue: 1,
            isActive: false,
          },
        ],
      },
    });

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error('Expected active track membership mismatch validation to fail');
    }

    expect(result.error.code).toBe('invalidPayload');
  });

  test('rejects legacy track keys that are sent without structured references', () => {
    const result = validateAimpProtocolMessage({
      type: 'playbackSnapshot',
      protocolVersion: AIMP_PROTOCOL_VERSION,
      sequence: 11,
      messageId: 'playback-key-only',
      sentAt: '2026-03-13T10:00:02.000Z',
      payload: {
        revision: 7,
        status: 'paused',
        currentTrack: null,
        currentTrackKey: 'native:track-1',
        positionMs: 45000,
      },
    });

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error('Expected key-only playback identity validation to fail');
    }

    expect(result.error.code).toBe('invalidPayload');
  });

  test('does not fabricate currentTrackKey when playback snapshot omits an explicit track', () => {
    const playbackResult = validateAimpProtocolMessage({
      type: 'playbackSnapshot',
      protocolVersion: AIMP_PROTOCOL_VERSION,
      sequence: 12,
      messageId: 'playback-without-track',
      sentAt: '2026-03-13T10:00:02.000Z',
      payload: {
        revision: 7,
        status: 'paused',
        currentTrack: null,
        positionMs: 45000,
        durationMs: 120000,
      },
    });

    expect(playbackResult.success).toBe(true);
    if (!playbackResult.success) {
      throw new Error(playbackResult.error.message);
    }

    const playbackDto = normalizeAimpPlaybackSnapshot(
      playbackResult.value,
      '2026-03-13T10:00:02.100Z',
    );

    expect(playbackDto.currentTrackKey).toBeNull();
  });

  test('validates bridge state responses exposed through preload IPC', () => {
    const state = createInitialAimpBridgeState();

    expect(validateAimpBridgeState(state)).toEqual({
      success: true,
      value: state,
    });

    expect(
      validateAimpBridgeStateResponse({
        success: true,
        data: state,
      }),
    ).toEqual({
      success: true,
      value: {
        success: true,
        data: state,
      },
    });

    const invalidResponse = validateAimpBridgeStateResponse({
      success: false,
      data: state,
    });
    expect(invalidResponse.success).toBe(false);
  });

  test('rejects bridge states with invalid nested DTO fields', () => {
    const state = createInitialAimpBridgeState();
    const invalidState = {
      ...state,
      environment: {
        ...state.environment,
        gatingReasons: [
          {
            code: 'sourceNotAimp',
            message: 42,
          },
        ],
      },
    };

    const result = validateAimpBridgeState(invalidState);
    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error('Expected nested bridge state validation to fail');
    }

    expect(result.error.code).toBe('invalidPayload');
  });

  test('rejects bridge states whose compatibility checkpoint diverges from normalized state', () => {
    const state = createInitialAimpBridgeState();
    const invalidState = {
      ...state,
      compatibilityCheckpointInput: {
        ...state.compatibilityCheckpointInput,
        liveStreamStarted: true,
      },
    };

    const result = validateAimpBridgeState(invalidState);
    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error('Expected mismatched compatibility checkpoint validation to fail');
    }

    expect(result.error.code).toBe('invalidPayload');
  });

  test('rejects bridge states that mark liveStreamStarted before usable snapshots exist', () => {
    const helloResult = validateAimpProtocolMessage({
      type: 'hello',
      protocolVersion: AIMP_PROTOCOL_VERSION,
      sequence: 1,
      messageId: 'hello-live-stream-ready',
      sentAt: '2026-03-13T10:00:00.000Z',
      payload: {
        pluginName: 'CherryPlay AIMP Bridge',
        pluginVersion: '0.1.0',
        aimpVersion: '5.40.2683',
        architecture: 'x64',
        platform: 'win32',
        instanceId: 'instance-live-stream-ready',
      },
    });
    expect(helloResult.success).toBe(true);
    if (!helloResult.success) {
      throw new Error(helloResult.error.message);
    }

    const state = {
      ...createInitialAimpBridgeState(),
      sourceSelection: 'aimp' as const,
      liveStreamStarted: true,
      environment: {
        eligible: true,
        pipeName: '\\\\.\\pipe\\cherryplay-aimp-v1',
        platform: 'win32',
        architecture: 'x64',
        gatingReasons: [],
      },
      connection: {
        phase: 'connected' as const,
        appListening: true,
        pluginConnected: true,
        staleAfterMs: 15000,
        lastMessageAt: '2026-03-13T10:00:01.000Z',
        lastHeartbeatAt: null,
        disconnectReason: null,
        protocolError: null,
      },
      pluginMetadata: normalizeAimpPluginMetadata(helloResult.value, '2026-03-13T10:00:00.100Z'),
      playlistSnapshot: null,
      playbackSnapshot: null,
    };
    state.compatibilityCheckpointInput = createAimpCompatibilityCheckpointInput(state);

    const result = validateAimpBridgeState(state);
    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error('Expected live-stream readiness validation to fail');
    }

    expect(result.error.code).toBe('invalidPayload');
    expect(result.error.message).toContain('usable playlistSnapshot and playbackSnapshot DTOs');
  });

  test('rejects bridge states whose playback currentTrackKey is missing from the latest playlist', () => {
    const helloResult = validateAimpProtocolMessage({
      type: 'hello',
      protocolVersion: AIMP_PROTOCOL_VERSION,
      sequence: 1,
      messageId: 'hello-cross-snapshot',
      sentAt: '2026-03-13T10:00:00.000Z',
      payload: {
        pluginName: 'CherryPlay AIMP Bridge',
        pluginVersion: '0.1.0',
        aimpVersion: '5.40.2683',
        architecture: 'x64',
        platform: 'win32',
        instanceId: 'instance-cross-snapshot',
      },
    });
    expect(helloResult.success).toBe(true);
    if (!helloResult.success) {
      throw new Error(helloResult.error.message);
    }

    const playlistResult = validateAimpProtocolMessage({
      type: 'playlistSnapshot',
      protocolVersion: AIMP_PROTOCOL_VERSION,
      sequence: 2,
      messageId: 'playlist-cross-snapshot',
      sentAt: '2026-03-13T10:00:01.000Z',
      payload: {
        playlistId: 'main-playlist',
        playlistName: 'Main Playlist',
        revision: 1,
        activeTrack: {
          nativeTrackId: 'track-1',
        },
        tracks: [
          {
            nativeTrackId: 'track-1',
            title: 'Track 1',
            durationMs: 120000,
            positionInQueue: 0,
            isActive: true,
          },
        ],
      },
    });
    expect(playlistResult.success).toBe(true);
    if (!playlistResult.success) {
      throw new Error(playlistResult.error.message);
    }

    const playbackResult = validateAimpProtocolMessage({
      type: 'playbackSnapshot',
      protocolVersion: AIMP_PROTOCOL_VERSION,
      sequence: 3,
      messageId: 'playback-cross-snapshot',
      sentAt: '2026-03-13T10:00:02.000Z',
      payload: {
        revision: 1,
        status: 'playing',
        currentTrack: {
          nativeTrackId: 'track-2',
        },
        positionMs: 1000,
        durationMs: 120000,
        isMuted: false,
      },
    });
    expect(playbackResult.success).toBe(true);
    if (!playbackResult.success) {
      throw new Error(playbackResult.error.message);
    }

    const state = {
      ...createInitialAimpBridgeState(),
      sourceSelection: 'aimp' as const,
      liveStreamStarted: false,
      environment: {
        eligible: true,
        pipeName: '\\\\.\\pipe\\cherryplay-aimp-v1',
        platform: 'win32',
        architecture: 'x64',
        gatingReasons: [],
      },
      connection: {
        phase: 'connected' as const,
        appListening: true,
        pluginConnected: true,
        staleAfterMs: 15000,
        lastMessageAt: '2026-03-13T10:00:02.000Z',
        lastHeartbeatAt: null,
        disconnectReason: null,
        protocolError: null,
      },
      pluginMetadata: normalizeAimpPluginMetadata(helloResult.value, '2026-03-13T10:00:00.100Z'),
      playlistSnapshot: normalizeAimpPlaylistSnapshot(
        playlistResult.value,
        '2026-03-13T10:00:01.100Z',
      ),
      playbackSnapshot: normalizeAimpPlaybackSnapshot(
        playbackResult.value,
        '2026-03-13T10:00:02.100Z',
      ),
    };
    state.compatibilityCheckpointInput = createAimpCompatibilityCheckpointInput(state);

    const result = validateAimpBridgeState(state);
    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error('Expected cross-snapshot track membership validation to fail');
    }

    expect(result.error.code).toBe('invalidPayload');
    expect(result.error.message).toContain('currentTrackKey must exist');
  });

  test('validates renderer-facing AIMP IPC payloads', () => {
    expect(
      validateAimpSourceSelectionPayload({
        sourceSelection: 'aimp',
      }),
    ).toEqual({
      success: true,
      value: { sourceSelection: 'aimp' },
    });

    expect(
      validateAimpLiveStreamPayload({
        liveStreamStarted: true,
      }),
    ).toEqual({
      success: true,
      value: { liveStreamStarted: true },
    });

    const invalidSourceSelection = validateAimpSourceSelectionPayload({
      sourceSelection: 'invalid-source',
    });
    expect(invalidSourceSelection.success).toBe(false);

    const invalidLiveStreamPayload = validateAimpLiveStreamPayload({
      liveStreamStarted: 'yes',
    });
    expect(invalidLiveStreamPayload.success).toBe(false);
  });
});
