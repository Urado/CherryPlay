jest.mock('electron', () => ({
  app: {
    isPackaged: false,
    getAppPath: () => 'd:\\CherryPlay\\CherryPlayList',
  },
}));

import { EventEmitter } from 'node:events';
import * as fs from 'node:fs';
import * as net from 'node:net';
import * as path from 'node:path';

import { AimpIntegrationService, aimpIntegrationService } from '../../electron/aimp/service';
import {
  AIMP_HEARTBEAT_INTERVAL_MS,
  AIMP_PROTOCOL_MESSAGE_DELIMITER,
  AIMP_PROTOCOL_VERSION,
  createAimpHelloAckMessage,
  type AimpProtocolMessage,
  validateAimpServerProtocolMessage,
} from '../../src/shared/contracts/aimp';

type OriginalReadFileSync = (
  path: fs.PathOrFileDescriptor,
  options?: Parameters<typeof fs.readFileSync>[1],
) => ReturnType<typeof fs.readFileSync>;

interface AimpFixture {
  fixtureId: string;
  description: string;
  pipeName: string;
  protocolVersion: string;
  expectedRendererState: Record<string, unknown>;
  expectedServerMessages?: unknown[];
  messages: unknown[];
}

const originalReadFileSync = fs.readFileSync.bind(fs) as OriginalReadFileSync;
const fixturesDirectory = path.resolve(__dirname, '../../electron/aimp/fixtures');
const manifestSuffix = path.join('plugins', 'aimp', 'manifest.json');
const validManifest = {
  name: 'cherryplay-aimp-bridge',
  version: '0.1.0',
  protocolVersion: AIMP_PROTOCOL_VERSION,
  pipeName: '\\\\.\\pipe\\cherryplay-aimp-v1',
  supportedPlatforms: ['win32'],
  supportedArchitectures: ['x64'],
  main: 'CherryPlayAimpBridge.dll',
};
const originalPlatformDescriptor = Object.getOwnPropertyDescriptor(process, 'platform');
const originalArchDescriptor = Object.getOwnPropertyDescriptor(process, 'arch');

class FakeSocket extends EventEmitter {
  public destroyed = false;
  public readonly writtenPayloads: string[] = [];

  setEncoding(_encoding: BufferEncoding): void {}

  write(
    chunk: string | Uint8Array,
    encodingOrCallback?: BufferEncoding | (() => void),
    maybeCallback?: () => void,
  ): boolean {
    this.writtenPayloads.push(
      typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8'),
    );
    const callback = typeof encodingOrCallback === 'function' ? encodingOrCallback : maybeCallback;
    callback?.();
    return true;
  }

  end(
    chunkOrCallback?: string | Uint8Array | (() => void),
    encodingOrCallback?: BufferEncoding | (() => void),
    maybeCallback?: () => void,
  ): this {
    if (typeof chunkOrCallback === 'string' || chunkOrCallback instanceof Uint8Array) {
      this.write(chunkOrCallback);
    }

    const callback =
      typeof chunkOrCallback === 'function'
        ? chunkOrCallback
        : typeof encodingOrCallback === 'function'
          ? encodingOrCallback
          : maybeCallback;

    this.destroyed = true;
    callback?.();
    this.emit('close', false);
    return this;
  }

  destroy(): void {
    this.destroyed = true;
  }

  emitProtocolMessage(message: unknown): void {
    this.emit('data', JSON.stringify(message) + AIMP_PROTOCOL_MESSAGE_DELIMITER);
  }
}

class FakeServer extends EventEmitter {
  public listenPath: string | null = null;
  private readonly handleConnection: (socket: net.Socket) => void;

  constructor(handleConnection: (socket: net.Socket) => void) {
    super();
    this.handleConnection = handleConnection;
  }

  listen(pathToListen: net.ListenOptions | string, callback?: () => void): this {
    this.listenPath = typeof pathToListen === 'string' ? pathToListen : String(pathToListen);
    callback?.();
    return this;
  }

  close(callback?: (err?: Error) => void): this {
    callback?.();
    return this;
  }

  connect(socket: FakeSocket): void {
    this.handleConnection(socket as unknown as net.Socket);
  }
}

function loadFixture(name: string): AimpFixture {
  return JSON.parse(
    originalReadFileSync(path.join(fixturesDirectory, `${name}.json`), 'utf8') as string,
  ) as AimpFixture;
}

function setProcessRuntime(platform: NodeJS.Platform, arch: string): void {
  Object.defineProperty(process, 'platform', {
    configurable: true,
    value: platform,
  });
  Object.defineProperty(process, 'arch', {
    configurable: true,
    value: arch,
  });
}

function restoreProcessRuntime(): void {
  if (originalPlatformDescriptor) {
    Object.defineProperty(process, 'platform', originalPlatformDescriptor);
  }

  if (originalArchDescriptor) {
    Object.defineProperty(process, 'arch', originalArchDescriptor);
  }
}

function readServerMessages(socket: FakeSocket): unknown[] {
  return socket.writtenPayloads
    .flatMap((payload) => payload.split(AIMP_PROTOCOL_MESSAGE_DELIMITER))
    .map((payload) => payload.trim())
    .filter((payload) => payload.length > 0)
    .map((payload) => JSON.parse(payload) as unknown);
}

describe('AimpIntegrationService lifecycle', () => {
  let service: AimpIntegrationService;
  let existsSyncSpy: jest.SpiedFunction<typeof fs.existsSync>;
  let readFileSyncSpy: jest.SpiedFunction<typeof fs.readFileSync>;
  let createServerSpy: jest.SpiedFunction<typeof net.createServer>;
  let createdServers: FakeServer[];

  function configureManifest(
    mode: 'valid' | 'missing' | 'invalidJson' | 'invalidContract' = 'valid',
  ): void {
    existsSyncSpy.mockImplementation((targetPath) => {
      return targetPath.toString().endsWith(manifestSuffix) && mode !== 'missing';
    });

    readFileSyncSpy.mockImplementation(((targetPath: fs.PathOrFileDescriptor) => {
      const normalizedPath = targetPath.toString();
      if (!normalizedPath.endsWith(manifestSuffix)) {
        return originalReadFileSync(targetPath, 'utf8');
      }

      if (mode === 'invalidJson') {
        return '{invalid-json';
      }

      if (mode === 'invalidContract') {
        return JSON.stringify({
          ...validManifest,
          supportedArchitectures: ['ia32'],
        });
      }

      return JSON.stringify(validManifest);
    }) as typeof fs.readFileSync);
  }

  function createService(): void {
    service?.dispose();
    service = new AimpIntegrationService();
  }

  function connectSocket(): FakeSocket {
    const socket = new FakeSocket();
    expect(createdServers).toHaveLength(1);
    createdServers[0].connect(socket);
    return socket;
  }

  function emitFixture(socket: FakeSocket, fixture: AimpFixture): void {
    fixture.messages.forEach((message) => {
      socket.emitProtocolMessage(message);
    });
  }

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-13T10:00:00.000Z'));
    existsSyncSpy = jest.spyOn(fs, 'existsSync');
    readFileSyncSpy = jest.spyOn(fs, 'readFileSync');
    createServerSpy = jest.spyOn(net, 'createServer');
    createdServers = [];
    createServerSpy.mockImplementation((connectionListener?: (socket: net.Socket) => void) => {
      const server = new FakeServer(connectionListener ?? (() => undefined));
      createdServers.push(server);
      return server as unknown as net.Server;
    });
    setProcessRuntime('win32', 'x64');
    configureManifest('valid');
    service = new AimpIntegrationService();
  });

  afterEach(() => {
    service.dispose();
    jest.restoreAllMocks();
    restoreProcessRuntime();
    jest.useRealTimers();
  });

  afterAll(() => {
    aimpIntegrationService.dispose();
  });

  test('keeps the named-pipe server disabled until source selection switches to AIMP', () => {
    const initialState = service.getState();

    expect(createServerSpy).not.toHaveBeenCalled();
    expect(initialState.environment.eligible).toBe(false);
    expect(initialState.environment.gatingReasons.map((reason) => reason.code)).toContain(
      'sourceNotAimp',
    );

    const updatedState = service.setSourceSelection('aimp');

    expect(createServerSpy).toHaveBeenCalledTimes(1);
    expect(updatedState.environment.eligible).toBe(true);
    expect(updatedState.connection.phase).toBe('listening');
    expect(updatedState.connection.appListening).toBe(true);
    expect(createdServers[0].listenPath).toBe(updatedState.pipeName);
  });

  test('blocks startup on unsupported platform and architecture', () => {
    setProcessRuntime('linux', 'arm64');
    createService();

    const state = service.setSourceSelection('aimp');

    expect(createServerSpy).not.toHaveBeenCalled();
    expect(state.environment.eligible).toBe(false);
    expect(state.environment.gatingReasons.map((reason) => reason.code)).toEqual(
      expect.arrayContaining(['unsupportedPlatform', 'unsupportedArchitecture']),
    );
    expect(state.connection.phase).toBe('disconnected');
    expect(state.connection.disconnectReason).toBeNull();
  });

  test('blocks startup when the plugin manifest is missing', () => {
    configureManifest('missing');
    createService();

    const state = service.setSourceSelection('aimp');

    expect(createServerSpy).not.toHaveBeenCalled();
    expect(state.environment.eligible).toBe(false);
    expect(state.environment.gatingReasons.map((reason) => reason.code)).toContain(
      'pluginManifestMissing',
    );
    expect(state.connection.disconnectReason).toBeNull();
  });

  test('blocks startup when the plugin manifest is invalid', () => {
    configureManifest('invalidContract');
    createService();

    const state = service.setSourceSelection('aimp');

    expect(createServerSpy).not.toHaveBeenCalled();
    expect(state.environment.eligible).toBe(false);
    expect(state.environment.gatingReasons.map((reason) => reason.code)).toContain(
      'pluginManifestInvalid',
    );
    expect(state.connection.disconnectReason).toBeNull();
  });

  test('switching away from AIMP recomputes environment eligibility and drops stale transient gating', () => {
    service.setSourceSelection('aimp');
    service['transientGatingReason'] = {
      code: 'pipeListenFailed',
      message: 'Previous listen failure should not leak into CherryPlay Player state.',
    };

    const state = service.setSourceSelection('cherryPlayPlayer');

    expect(state.sourceSelection).toBe('cherryPlayPlayer');
    expect(state.environment.eligible).toBe(false);
    expect(state.environment.gatingReasons.map((reason) => reason.code)).toContain('sourceNotAimp');
    expect(state.environment.gatingReasons.map((reason) => reason.code)).not.toContain(
      'pipeListenFailed',
    );
    expect(state.connection.phase).toBe('disconnected');
    expect(state.connection.appListening).toBe(false);
    expect(state.connection.disconnectReason?.code).toBe('sourceDisabled');
  });

  test('consumes the happy-path fixture and leaves renderer state connected', () => {
    const fixture = loadFixture('happy-path');

    service.setSourceSelection('aimp');
    const socket = connectSocket();
    emitFixture(socket, fixture);

    expect(readServerMessages(socket)).toEqual(fixture.expectedServerMessages);

    const state = service.getState();
    expect(state.connection.phase).toBe(fixture.expectedRendererState.connectionPhase);
    expect(state.connection.appListening).toBe(fixture.expectedRendererState.appListening);
    expect(state.connection.pluginConnected).toBe(fixture.expectedRendererState.pluginConnected);
    expect(state.liveStreamStarted).toBe(fixture.expectedRendererState.liveStreamStarted);
    expect(state.pluginMetadata?.instanceId).toBe('aimp-instance-001');
    expect(state.playlistSnapshot?.trackCount).toBe(2);
    expect(state.playbackSnapshot?.currentTrackKey).toBe('native:track-002');
  });

  test('consumes the disconnect fixture and returns to listening with an explicit reason', () => {
    const fixture = loadFixture('disconnect');

    service.setSourceSelection('aimp');
    const socket = connectSocket();
    emitFixture(socket, fixture);

    expect(readServerMessages(socket)).toEqual(fixture.expectedServerMessages);

    const state = service.getState();
    expect(state.connection.phase).toBe(fixture.expectedRendererState.connectionPhase);
    expect(state.connection.appListening).toBe(fixture.expectedRendererState.appListening);
    expect(state.connection.pluginConnected).toBe(fixture.expectedRendererState.pluginConnected);
    expect(state.connection.disconnectReason?.code).toBe(
      fixture.expectedRendererState.disconnectReasonCode,
    );
    expect(state.connection.disconnectReason?.message).toContain('pluginShutdown');
    expect(state.connection.disconnectReason?.detail).toContain('reason=pluginShutdown');
    expect(state.pluginMetadata).toBeNull();
    expect(state.playlistSnapshot).toBeNull();
    expect(state.playbackSnapshot).toBeNull();
  });

  test('consumes the stale-heartbeat fixture and transitions into stale mode after the timeout', () => {
    const fixture = loadFixture('stale-heartbeat');

    service.setSourceSelection('aimp');
    const socket = connectSocket();
    emitFixture(socket, fixture);

    expect(readServerMessages(socket)).toEqual(fixture.expectedServerMessages);

    jest.advanceTimersByTime(Number(fixture.expectedRendererState.waitMsAfterLastMessage));

    const state = service.getState();
    expect(state.connection.phase).toBe(fixture.expectedRendererState.connectionPhase);
    expect(state.connection.appListening).toBe(fixture.expectedRendererState.appListening);
    expect(state.connection.pluginConnected).toBe(fixture.expectedRendererState.pluginConnected);
    expect(state.connection.disconnectReason?.code).toBe('heartbeatTimeout');
  });

  test('consumes the version-mismatch fixture and keeps listening for a later reconnect', () => {
    const fixture = loadFixture('version-mismatch');

    service.setSourceSelection('aimp');
    const socket = connectSocket();
    emitFixture(socket, fixture);

    expect(readServerMessages(socket)).toEqual(fixture.expectedServerMessages);

    const state = service.getState();
    expect(state.connection.phase).toBe(fixture.expectedRendererState.connectionPhase);
    expect(state.connection.appListening).toBe(fixture.expectedRendererState.appListening);
    expect(state.connection.pluginConnected).toBe(fixture.expectedRendererState.pluginConnected);
    expect(state.connection.protocolError?.code).toBe(
      fixture.expectedRendererState.protocolErrorCode,
    );
    expect(state.connection.disconnectReason?.code).toBe(
      fixture.expectedRendererState.disconnectReasonCode,
    );
    expect(state.connection.disconnectReason?.detail).toContain('Supported versions: 1.0.0');
  });

  test('sends an accepted helloAck immediately after a valid hello handshake', () => {
    service.setSourceSelection('aimp');
    const socket = connectSocket();

    socket.emitProtocolMessage({
      type: 'hello',
      protocolVersion: AIMP_PROTOCOL_VERSION,
      sequence: 1,
      messageId: 'hello-only',
      sentAt: '2026-03-13T10:00:00.000Z',
      payload: {
        pluginName: 'CherryPlay AIMP Bridge',
        pluginVersion: '0.1.0',
        aimpVersion: '5.40.2683',
        architecture: 'x64',
        platform: 'win32',
        instanceId: 'ack-instance-001',
      },
    });

    const serverMessages = readServerMessages(socket);
    expect(serverMessages).toHaveLength(1);
    expect(validateAimpServerProtocolMessage(serverMessages[0])).toEqual({
      success: true,
      value: createAimpHelloAckMessage({
        sequence: 1,
        accepted: true,
        sentAt: '2026-03-13T10:00:00.000Z',
        messageId: 'server-helloAck-1',
      }),
    });
  });

  test('rejects out-of-order or duplicate sequence numbers within one socket session', () => {
    const fixture = loadFixture('happy-path');

    service.setSourceSelection('aimp');
    const socket = connectSocket();
    socket.emitProtocolMessage(fixture.messages[0]);
    socket.emitProtocolMessage({
      ...(fixture.messages[1] as AimpProtocolMessage),
      sequence: 1,
      messageId: 'duplicate-sequence',
    });

    const state = service.getState();
    expect(state.connection.phase).toBe('listening');
    expect(state.connection.pluginConnected).toBe(false);
    expect(state.connection.protocolError?.code).toBe('invalidEnvelope');
    expect(state.connection.disconnectReason?.code).toBe('malformedPayload');
  });

  test('guards live-stream start when source selection is not AIMP', () => {
    expect(() => service.setLiveStreamStarted(true)).toThrow(
      'AIMP live streaming can start only when the selected source is AIMP.',
    );
  });

  test('guards live-stream start when the environment is ineligible', () => {
    configureManifest('missing');
    createService();
    service.setSourceSelection('aimp');

    expect(() => service.setLiveStreamStarted(true)).toThrow('AIMP plugin manifest not found.');
  });

  test('guards live-stream start until the plugin session is connected', () => {
    service.setSourceSelection('aimp');

    expect(() => service.setLiveStreamStarted(true)).toThrow(
      'AIMP live streaming can start only after the plugin completes a connected session handshake.',
    );
  });

  test('guards live-stream start until both normalized snapshots exist after handshake', () => {
    const fixture = loadFixture('happy-path');

    service.setSourceSelection('aimp');
    const socket = connectSocket();
    socket.emitProtocolMessage(fixture.messages[0]);

    expect(() => service.setLiveStreamStarted(true)).toThrow(
      'AIMP live streaming can start only after usable playlist and playback snapshots are available from the connected plugin session.',
    );

    socket.emitProtocolMessage(fixture.messages[1]);

    expect(() => service.setLiveStreamStarted(true)).toThrow(
      'AIMP live streaming can start only after usable playlist and playback snapshots are available from the connected plugin session.',
    );
  });

  test('allows live-stream start only after a valid connected fixture session exists', () => {
    const fixture = loadFixture('happy-path');

    service.setSourceSelection('aimp');
    const socket = connectSocket();
    emitFixture(socket, fixture);

    const state = service.setLiveStreamStarted(true);

    expect(state.liveStreamStarted).toBe(true);
    expect(state.sourceSelection).toBe('aimp');
    expect(state.connection.phase).toBe('connected');
    expect(state.connection.pluginConnected).toBe(true);
  });

  test('downgrades playback snapshot when a playback update points to a track missing from the latest playlist', () => {
    const fixture = loadFixture('happy-path');

    service.setSourceSelection('aimp');
    const socket = connectSocket();
    socket.emitProtocolMessage(fixture.messages[0]);
    socket.emitProtocolMessage(fixture.messages[1]);
    socket.emitProtocolMessage({
      ...(fixture.messages[2] as AimpProtocolMessage),
      sequence: 3,
      messageId: 'playback-track-missing',
      payload: {
        ...(
          fixture.messages[2] as AimpProtocolMessage & {
            payload: Record<string, unknown>;
          }
        ).payload,
        currentTrack: {
          nativeTrackId: 'track-404',
        },
      },
    });

    const state = service.getState();
    expect(state.connection.phase).toBe('connected');
    expect(state.connection.pluginConnected).toBe(true);
    expect(state.playlistSnapshot?.trackCount).toBe(2);
    expect(state.playbackSnapshot).toBeNull();
  });

  test('downgrades an existing playback snapshot when a newer playlist no longer contains its current track', () => {
    const fixture = loadFixture('happy-path');

    service.setSourceSelection('aimp');
    const socket = connectSocket();
    emitFixture(socket, {
      ...fixture,
      messages: fixture.messages.slice(0, 3),
    });

    socket.emitProtocolMessage({
      ...(fixture.messages[1] as AimpProtocolMessage),
      sequence: 4,
      messageId: 'playlist-track-removed',
      payload: {
        ...(
          fixture.messages[1] as AimpProtocolMessage & {
            payload: Record<string, unknown>;
          }
        ).payload,
        revision: 5,
        activeTrack: {
          nativeTrackId: 'track-001',
        },
        tracks: [
          {
            nativeTrackId: 'track-001',
            filePath: 'C:\\Music\\Artist One\\Intro.mp3',
            title: 'Intro',
            artist: 'Artist One',
            album: 'Club Set',
            durationMs: 90000,
            positionInQueue: 0,
            isActive: true,
          },
        ],
      },
    });

    const state = service.getState();
    expect(state.connection.phase).toBe('connected');
    expect(state.connection.pluginConnected).toBe(true);
    expect(state.playlistSnapshot?.activeTrackKey).toBe('native:track-001');
    expect(state.playbackSnapshot).toBeNull();
  });

  test('unexpected socket close clears stale live data and records transportClosed', () => {
    const fixture = loadFixture('happy-path');

    service.setSourceSelection('aimp');
    const socket = connectSocket();
    emitFixture(socket, {
      ...fixture,
      messages: fixture.messages.slice(0, 3),
    });
    socket.emit('close', false);

    const state = service.getState();
    expect(state.connection.phase).toBe('listening');
    expect(state.connection.pluginConnected).toBe(false);
    expect(state.connection.disconnectReason?.code).toBe('transportClosed');
    expect(state.connection.disconnectReason?.message).toContain('after handshake');
    expect(state.pluginMetadata).toBeNull();
    expect(state.playlistSnapshot).toBeNull();
    expect(state.playbackSnapshot).toBeNull();
  });

  test('raw close before handshake reports a handshake-specific disconnect reason', () => {
    service.setSourceSelection('aimp');
    const socket = connectSocket();

    socket.emit('close', false);

    const state = service.getState();
    expect(state.connection.phase).toBe('listening');
    expect(state.connection.disconnectReason?.code).toBe('transportClosed');
    expect(state.connection.disconnectReason?.message).toContain('before completing');
  });

  test('heartbeat timeout enters stale mode and later heartbeats recover the connection', () => {
    const fixture = loadFixture('stale-heartbeat');

    service.setSourceSelection('aimp');
    const socket = connectSocket();
    socket.emitProtocolMessage(fixture.messages[0]);
    service['lastLivenessAtMs'] =
      Date.now() - Number(fixture.expectedRendererState.waitMsAfterLastMessage);

    jest.advanceTimersByTime(AIMP_HEARTBEAT_INTERVAL_MS);

    let state = service.getState();
    expect(state.connection.phase).toBe('stale');
    expect(state.connection.disconnectReason?.code).toBe('heartbeatTimeout');

    socket.emitProtocolMessage(fixture.messages[2]);

    state = service.getState();
    expect(state.connection.phase).toBe('connected');
    expect(state.connection.pluginConnected).toBe(true);
    expect(state.connection.disconnectReason).toBeNull();
  });
});
