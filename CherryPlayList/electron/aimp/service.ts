import * as fs from 'node:fs';
import * as net from 'node:net';
import * as path from 'node:path';

import { app } from 'electron';

import {
  AIMP_HEARTBEAT_INTERVAL_MS,
  AIMP_HEARTBEAT_STALE_TIMEOUT_MS,
  AIMP_MAX_MESSAGE_BYTES,
  AIMP_PROTOCOL_MESSAGE_DELIMITER,
  AIMP_PROTOCOL_PIPE_NAME,
  AIMP_PROTOCOL_VERSION,
  AimpBridgeState,
  AimpDisconnectReason,
  AimpGatingReason,
  AimpGoodbyeMessage,
  AimpHelloAckErrorCode,
  AimpHelloMessage,
  AimpPlaybackSnapshotMessage,
  AimpPlaylistSnapshotMessage,
  AimpProtocolMessage,
  AimpSourceSelection,
  createAimpHelloAckMessage,
  createAimpCompatibilityCheckpointInput,
  createInitialAimpBridgeState,
  getAimpPlaybackPlaylistConsistencyError,
  hasUsableAimpLiveStreamSnapshots,
  getAimpProtocolVersionError,
  normalizeAimpPlaybackSnapshot,
  normalizeAimpPlaylistSnapshot,
  normalizeAimpPluginMetadata,
  validateAimpPluginManifest,
  validateAimpProtocolMessage,
  type AimpLogEntry,
} from '../../src/shared/contracts/aimp.js';
import { logger } from '../utils/logger.js';

/** Same folder name as AIMP uses for the plugin (DLL basename without extension). */
const AIMP_BRIDGE_PLUGIN_DIR = 'CherryPlayAimpBridge';

export type { AimpLogEntry };

type AimpStateListener = (state: AimpBridgeState) => void;
type AimpLogListener = (entry: AimpLogEntry) => void;

function cloneState<T>(value: T): T {
  if (typeof globalThis.structuredClone === 'function') {
    return globalThis.structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value)) as T;
}

function getPluginsBasePaths(): string[] {
  const pluginsBasePaths = app.isPackaged
    ? [
        // `extraResources` lands under `resources`, while older builds that used
        // `extraFiles` place plugins beside the executable. Probe both.
        path.join(path.dirname(process.execPath), 'plugins'),
        path.join(process.resourcesPath, 'plugins'),
      ]
    : [path.join(process.cwd(), 'plugins'), path.join(app.getAppPath(), 'plugins')];

  return [...new Set(pluginsBasePaths)];
}

function getAimpPluginManifestPaths(): string[] {
  const underPlugins = getPluginsBasePaths().map((pluginsBasePath) =>
    path.join(pluginsBasePath, AIMP_BRIDGE_PLUGIN_DIR, 'manifest.json'),
  );
  const besideExe = app.isPackaged
    ? [path.join(path.dirname(process.execPath), AIMP_BRIDGE_PLUGIN_DIR, 'manifest.json')]
    : [];
  return [...new Set([...underPlugins, ...besideExe])];
}

function resolveAimpPluginManifestPath(): string | null {
  return getAimpPluginManifestPaths().find((manifestPath) => fs.existsSync(manifestPath)) ?? null;
}

function getNowIsoString(): string {
  return new Date().toISOString();
}

function toDisconnectReason(
  code: AimpDisconnectReason['code'],
  message: string,
  detail?: string,
): AimpDisconnectReason {
  return {
    code,
    message,
    detail: detail && detail.trim().length > 0 ? detail : undefined,
    occurredAt: getNowIsoString(),
  };
}

export class AimpIntegrationService {
  private state = createInitialAimpBridgeState();
  private listeners = new Set<AimpStateListener>();
  private logListeners = new Set<AimpLogListener>();
  private server: net.Server | null = null;
  private clientSocket: net.Socket | null = null;
  private clientBuffer = '';
  private hasCompletedHandshake = false;
  private lastSequence: number | null = null;
  private serverSequence = 0;
  private lastLivenessAtMs: number | null = null;
  private transientGatingReason: AimpGatingReason | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.refreshEnvironmentEligibility();
    this.startHeartbeatMonitor();
  }

  getState(): AimpBridgeState {
    return cloneState(this.state);
  }

  subscribe(listener: AimpStateListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  subscribeLog(listener: AimpLogListener): () => void {
    this.logListeners.add(listener);
    return () => {
      this.logListeners.delete(listener);
    };
  }

  private emitLog(
    level: AimpLogEntry['level'],
    event: string,
    message: string,
    data?: unknown,
  ): void {
    const entry: AimpLogEntry = {
      timestamp: getNowIsoString(),
      level,
      event,
      message,
      data,
    };
    Array.from(this.logListeners).forEach((listener) => {
      try {
        listener(entry);
      } catch (err) {
        logger.warn('[AIMP] Log listener threw', err);
      }
    });
  }

  setSourceSelection(sourceSelection: AimpSourceSelection): AimpBridgeState {
    if (this.state.sourceSelection === sourceSelection) {
      return this.getState();
    }

    logger.info('[AIMP] Source selection updated', { sourceSelection });

    this.state.sourceSelection = sourceSelection;
    if (sourceSelection !== 'aimp') {
      this.transientGatingReason = null;
      this.state.liveStreamStarted = false;
      this.stopListening('sourceDisabled', 'AIMP source was disabled by renderer state');
      this.refreshEnvironmentEligibility();
    } else {
      this.refreshEnvironmentEligibility();
      this.evaluateServerLifecycle();
    }

    this.emitState();
    return this.getState();
  }

  setLiveStreamStarted(liveStreamStarted: boolean): AimpBridgeState {
    if (liveStreamStarted) {
      this.assertCanStartLiveStream();
    }

    this.state.liveStreamStarted = liveStreamStarted;
    this.emitState();
    return this.getState();
  }

  dispose(): void {
    this.stopHeartbeatMonitor();
    this.stopListening('unknown', 'AIMP integration service disposed');
    this.listeners.clear();
  }

  private emitState(): void {
    this.state.compatibilityCheckpointInput = createAimpCompatibilityCheckpointInput(this.state);
    const snapshot = this.getState();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }

  private startHeartbeatMonitor(): void {
    if (this.heartbeatInterval) {
      return;
    }

    this.heartbeatInterval = setInterval(() => {
      if (!this.state.connection.pluginConnected || this.lastLivenessAtMs === null) {
        return;
      }

      const isStale = Date.now() - this.lastLivenessAtMs >= AIMP_HEARTBEAT_STALE_TIMEOUT_MS;
      if (isStale && this.state.connection.phase !== 'stale') {
        logger.warn('[AIMP] Heartbeat timeout reached, marking connection stale');
        this.state.connection.phase = 'stale';
        this.state.connection.disconnectReason = toDisconnectReason(
          'heartbeatTimeout',
          'No heartbeat or snapshot activity received before stale timeout elapsed.',
        );
        this.emitState();
      }
    }, AIMP_HEARTBEAT_INTERVAL_MS);
  }

  private stopHeartbeatMonitor(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private evaluateServerLifecycle(): void {
    this.refreshEnvironmentEligibility();

    if (this.state.sourceSelection !== 'aimp') {
      this.stopListening('sourceDisabled', 'AIMP named-pipe server is disabled for this source.');
      return;
    }

    if (this.state.environment.eligible) {
      this.ensureListening();
      return;
    }

    this.stopListeningForEnvironmentIneligible();
  }

  private refreshEnvironmentEligibility(): void {
    const gatingReasons: AimpGatingReason[] = [];
    const platform = process.platform;
    const architecture = process.arch;

    if (this.state.sourceSelection !== 'aimp') {
      gatingReasons.push({
        code: 'sourceNotAimp',
        message: 'AIMP named-pipe server starts only when the selected playback source is AIMP.',
      });
    }

    if (platform !== 'win32') {
      gatingReasons.push({
        code: 'unsupportedPlatform',
        message: `AIMP integration is Windows-only. Current platform: ${platform}.`,
      });
    }

    if (architecture !== 'x64') {
      gatingReasons.push({
        code: 'unsupportedArchitecture',
        message: `AIMP integration requires an x64 Electron build. Current architecture: ${architecture}.`,
      });
    }

    const manifestPath = resolveAimpPluginManifestPath();
    if (!manifestPath) {
      gatingReasons.push({
        code: 'pluginManifestMissing',
        message: `AIMP plugin manifest not found. Checked: ${getAimpPluginManifestPaths().join(', ')}.`,
      });
    } else {
      try {
        const manifestContent = fs.readFileSync(manifestPath, 'utf-8');
        const manifest = JSON.parse(manifestContent) as unknown;
        const manifestResult = validateAimpPluginManifest(manifest);
        if (!manifestResult.success) {
          gatingReasons.push({
            code: 'pluginManifestInvalid',
            message: manifestResult.error.message,
          });
        } else {
          const parsedManifest = manifestResult.value;
          if (parsedManifest.protocolVersion !== AIMP_PROTOCOL_VERSION) {
            gatingReasons.push({
              code: 'pluginManifestInvalid',
              message: `AIMP manifest protocolVersion must equal ${AIMP_PROTOCOL_VERSION}.`,
            });
          }

          if (parsedManifest.pipeName !== AIMP_PROTOCOL_PIPE_NAME) {
            gatingReasons.push({
              code: 'pluginManifestInvalid',
              message: `AIMP manifest pipeName must equal ${AIMP_PROTOCOL_PIPE_NAME}.`,
            });
          }

          if (!parsedManifest.supportedPlatforms.includes('win32')) {
            gatingReasons.push({
              code: 'pluginManifestInvalid',
              message: 'AIMP manifest must declare win32 support.',
            });
          }

          if (!parsedManifest.supportedArchitectures.includes('x64')) {
            gatingReasons.push({
              code: 'pluginManifestInvalid',
              message: 'AIMP manifest must declare x64 support.',
            });
          }
        }
      } catch (error) {
        gatingReasons.push({
          code: 'pluginManifestInvalid',
          message: `Failed to read AIMP manifest: ${(error as Error).message}`,
        });
      }
    }

    if (this.transientGatingReason) {
      gatingReasons.push(this.transientGatingReason);
    }

    this.state.environment = {
      eligible: gatingReasons.length === 0,
      pipeName: AIMP_PROTOCOL_PIPE_NAME,
      platform,
      architecture,
      gatingReasons,
    };
  }

  private ensureListening(): void {
    if (this.server) {
      return;
    }

    logger.info('[AIMP] Starting named-pipe server', { pipeName: AIMP_PROTOCOL_PIPE_NAME });

    this.server = net.createServer((socket) => {
      this.handleClientConnection(socket);
    });

    this.server.on('error', (error) => {
      logger.error('[AIMP] Named-pipe server error', error);
      this.transientGatingReason = {
        code: 'pipeListenFailed',
        message: `Failed to listen on AIMP named pipe: ${(error as Error).message}`,
      };
      this.refreshEnvironmentEligibility();
      this.state.connection.protocolError = {
        code: 'invalidEnvelope',
        message: 'AIMP named-pipe server failed to listen.',
        details: (error as Error).message,
      };
      this.stopListening(
        'listenFailed',
        'Named-pipe server listen failed',
        (error as Error).message,
      );
      this.emitState();
    });

    this.server.listen(AIMP_PROTOCOL_PIPE_NAME, () => {
      logger.info('[AIMP] Named-pipe server listening', { pipeName: AIMP_PROTOCOL_PIPE_NAME });
      this.transientGatingReason = null;
      this.refreshEnvironmentEligibility();
      this.state.connection.phase = 'listening';
      this.state.connection.appListening = true;
      this.state.connection.pluginConnected = false;
      this.state.connection.disconnectReason = null;
      this.state.connection.protocolError = null;
      this.emitState();
    });
  }

  private destroyTransport(): void {
    if (this.clientSocket) {
      this.clientSocket.removeAllListeners();
      this.clientSocket.destroy();
      this.clientSocket = null;
    }

    if (this.server) {
      this.server.removeAllListeners();
      this.server.close();
      this.server = null;
    }
  }

  private resetDisconnectedState(options?: {
    disconnectReason?: AimpDisconnectReason | null;
    preserveProtocolError?: boolean;
  }): void {
    this.clientBuffer = '';
    this.hasCompletedHandshake = false;
    this.lastSequence = null;
    this.serverSequence = 0;
    this.lastLivenessAtMs = null;
    this.clearLiveSnapshots({ preserveProtocolError: options?.preserveProtocolError });
    this.state.connection.phase = 'disconnected';
    this.state.connection.appListening = false;
    this.state.connection.pluginConnected = false;
    this.state.connection.disconnectReason = options?.disconnectReason ?? null;
  }

  private stopListening(
    code: AimpDisconnectReason['code'],
    message: string,
    detail?: string,
  ): void {
    this.destroyTransport();
    this.resetDisconnectedState({
      disconnectReason: toDisconnectReason(code, message, detail),
    });
  }

  private stopListeningForEnvironmentIneligible(): void {
    this.destroyTransport();
    this.resetDisconnectedState();
  }

  private clearLiveSnapshots(options?: { preserveProtocolError?: boolean }): void {
    this.state.pluginMetadata = null;
    this.state.playlistSnapshot = null;
    this.state.playbackSnapshot = null;
    this.state.connection.lastMessageAt = null;
    this.state.connection.lastHeartbeatAt = null;
    if (!options?.preserveProtocolError) {
      this.state.connection.protocolError = null;
    }
  }

  private handleClientConnection(socket: net.Socket): void {
    logger.info('[AIMP] Client transport connected');
    this.emitLog('info', 'connection', 'Plugin client connected', {});

    if (this.clientSocket) {
      logger.warn('[AIMP] Replacing existing AIMP connection with a new client');
      this.emitLog('warn', 'connection', 'Replacing existing plugin connection', {});
      this.closeClient(
        'connectionReplaced',
        'Existing AIMP client connection was replaced by a new socket.',
      );
    }

    this.clientSocket = socket;
    this.clientBuffer = '';
    this.hasCompletedHandshake = false;
    this.lastSequence = null;
    this.serverSequence = 0;
    this.lastLivenessAtMs = null;
    this.clearLiveSnapshots();
    this.state.connection.protocolError = null;
    this.state.connection.disconnectReason = null;
    this.state.connection.pluginConnected = false;
    this.state.connection.phase = 'listening';
    this.emitState();

    socket.setEncoding('utf8');

    socket.on('data', (chunk: string | Buffer) => {
      this.handleSocketData(typeof chunk === 'string' ? chunk : chunk.toString('utf8'));
    });

    socket.on('error', (error) => {
      logger.error('[AIMP] Client socket error', error);
      this.state.connection.protocolError = {
        code: 'invalidEnvelope',
        message: 'AIMP client socket error',
        details: (error as Error).message,
      };
      this.closeClient('transportError', 'AIMP client socket error', (error as Error).message);
    });

    socket.on('close', (hadError: boolean) => {
      logger.info('[AIMP] Client transport closed');
      if (this.clientSocket !== socket) {
        return;
      }

      const disconnectMessage = this.hasCompletedHandshake
        ? 'AIMP client transport closed unexpectedly after handshake.'
        : 'AIMP client transport closed before completing the hello handshake.';
      const disconnectReason =
        this.state.connection.disconnectReason ??
        toDisconnectReason(
          'transportClosed',
          disconnectMessage,
          hadError ? 'Socket close followed a transport error event.' : undefined,
        );
      this.clientSocket = null;
      this.clientBuffer = '';
      this.hasCompletedHandshake = false;
      this.serverSequence = 0;
      this.lastLivenessAtMs = null;
      this.clearLiveSnapshots({ preserveProtocolError: true });
      this.state.connection.pluginConnected = false;
      this.state.connection.phase = this.server ? 'listening' : 'disconnected';
      this.state.connection.appListening = Boolean(this.server);
      this.state.connection.disconnectReason = disconnectReason;
      this.emitLog('info', 'disconnect', disconnectMessage, {
        hadError,
        reason: disconnectReason?.code,
        detail: disconnectReason?.detail,
      });
      this.emitState();
    });
  }

  private handleSocketData(chunk: string): void {
    if (!this.clientSocket) {
      return;
    }

    this.clientBuffer += chunk;
    if (Buffer.byteLength(this.clientBuffer, 'utf8') > AIMP_MAX_MESSAGE_BYTES) {
      logger.warn('[AIMP] Dropping client connection because payload exceeded size limit');
      this.emitLog('warn', 'message:rejected', 'Payload exceeded size limit', {
        maxBytes: AIMP_MAX_MESSAGE_BYTES,
      });
      this.state.connection.protocolError = {
        code: 'payloadTooLarge',
        message: 'AIMP payload exceeded the maximum supported line size.',
      };
      this.closeClient('malformedPayload', 'AIMP payload exceeded the maximum line size.');
      return;
    }

    let delimiterIndex = this.clientBuffer.indexOf(AIMP_PROTOCOL_MESSAGE_DELIMITER);
    while (delimiterIndex >= 0) {
      const line = this.clientBuffer.slice(0, delimiterIndex).trim();
      this.clientBuffer = this.clientBuffer.slice(
        delimiterIndex + AIMP_PROTOCOL_MESSAGE_DELIMITER.length,
      );

      if (line.length > 0) {
        this.processProtocolLine(line);
      }

      delimiterIndex = this.clientBuffer.indexOf(AIMP_PROTOCOL_MESSAGE_DELIMITER);
    }
  }

  private processProtocolLine(line: string): void {
    let parsedMessage: unknown;

    try {
      parsedMessage = JSON.parse(line) as unknown;
    } catch (error) {
      logger.warn('[AIMP] Failed to parse JSON payload', { line });
      this.emitLog('warn', 'message:rejected', 'Invalid JSON payload', {
        error: (error as Error).message,
        lineLength: line.length,
      });
      this.state.connection.protocolError = {
        code: 'invalidJson',
        message: 'AIMP payload was not valid JSON.',
        details: (error as Error).message,
      };
      this.closeClient(
        'malformedPayload',
        'AIMP payload was not valid JSON.',
        (error as Error).message,
      );
      return;
    }

    const validationResult = validateAimpProtocolMessage(parsedMessage);
    if (!validationResult.success) {
      const protocolError =
        validationResult.error.code === 'unsupportedProtocolVersion'
          ? getAimpProtocolVersionError(
              isObjectWithProtocolVersion(parsedMessage)
                ? parsedMessage.protocolVersion
                : 'unknown',
            )
          : validationResult.error;

      logger.warn('[AIMP] Rejected protocol message', protocolError);
      this.emitLog('warn', 'message:rejected', protocolError.message, {
        code: protocolError.code,
        details: protocolError.details,
      });
      const disconnectCode =
        protocolError.code === 'unsupportedProtocolVersion'
          ? 'protocolVersionMismatch'
          : 'malformedPayload';

      if (isHelloHandshakeCandidate(parsedMessage)) {
        this.rejectHelloHandshake(
          disconnectCode,
          protocolError,
          protocolError.code === 'unsupportedProtocolVersion'
            ? 'unsupportedProtocolVersion'
            : 'rejected',
        );
        return;
      }

      this.state.connection.protocolError = protocolError;
      this.closeClient(disconnectCode, protocolError.message, protocolError.details);
      return;
    }

    const message = validationResult.value;
    this.emitLog('debug', 'message:received', `Received ${message.type}`, {
      type: message.type,
      sequence: message.sequence,
      messageId: message.messageId,
    });
    if (!this.hasCompletedHandshake && message.type !== 'hello') {
      logger.warn('[AIMP] Received non-hello message before handshake', { type: message.type });
      this.emitLog('warn', 'message:rejected', 'Non-hello message before handshake', {
        type: message.type,
      });
      this.state.connection.protocolError = {
        code: 'missingHandshake',
        message: 'AIMP connection must start with a hello handshake.',
        details: `Received ${message.type} before hello.`,
      };
      this.closeClient(
        'handshakeRequired',
        'AIMP connection must start with a hello handshake.',
        `Received ${message.type} before hello.`,
      );
      return;
    }

    if (this.hasCompletedHandshake && message.type === 'hello') {
      logger.warn('[AIMP] Received duplicate hello after handshake completed');
      this.emitLog('warn', 'message:rejected', 'Duplicate hello after handshake', {});
      this.state.connection.protocolError = {
        code: 'invalidEnvelope',
        message: 'AIMP connection cannot send hello more than once per socket session.',
      };
      this.closeClient(
        'malformedPayload',
        'AIMP connection cannot send hello more than once per socket session.',
      );
      return;
    }

    if (this.lastSequence !== null && message.sequence <= this.lastSequence) {
      logger.warn('[AIMP] Rejected out-of-order or duplicate sequence', {
        previousSequence: this.lastSequence,
        sequence: message.sequence,
        type: message.type,
      });
      this.emitLog('warn', 'message:rejected', 'Out-of-order or duplicate sequence', {
        previousSequence: this.lastSequence,
        sequence: message.sequence,
        type: message.type,
      });
      this.state.connection.protocolError = {
        code: 'invalidEnvelope',
        message: 'AIMP sequence must strictly increase within a socket session.',
        details: `Received sequence ${message.sequence} after ${this.lastSequence}.`,
      };
      this.closeClient(
        'malformedPayload',
        'AIMP sequence must strictly increase within a socket session.',
        `Received sequence ${message.sequence} after ${this.lastSequence}.`,
      );
      return;
    }

    this.lastSequence = message.sequence;
    this.recordLiveness(message.type === 'heartbeat');
    this.routeMessage(message);
  }

  private routeMessage(message: AimpProtocolMessage): void {
    switch (message.type) {
      case 'hello':
        this.handleHelloMessage(message);
        break;
      case 'playlistSnapshot':
        this.handlePlaylistSnapshotMessage(message);
        break;
      case 'playbackSnapshot':
        this.handlePlaybackSnapshotMessage(message);
        break;
      case 'heartbeat':
        this.handleHeartbeatMessage(message);
        break;
      case 'goodbye':
        this.handleGoodbyeMessage(message);
        break;
      default: {
        const exhaustiveCheck: never = message;
        logger.warn('[AIMP] Unexpected message routed', exhaustiveCheck);
      }
    }
  }

  private handleHelloMessage(message: AimpHelloMessage): void {
    const acknowledged = this.sendHelloAck(true);
    if (!acknowledged) {
      this.emitLog('warn', 'helloAck', 'Failed to send helloAck to plugin', {});
      this.state.connection.protocolError = {
        code: 'invalidEnvelope',
        message: 'AIMP hello handshake acknowledgement could not be written to the pipe.',
      };
      this.closeClient(
        'transportError',
        'AIMP hello handshake acknowledgement could not be written to the pipe.',
      );
      return;
    }

    this.emitLog('debug', 'helloAck:sent', 'Sent helloAck (accepted)', {
      sequence: message.sequence,
    });
    const connectedAt = getNowIsoString();
    this.hasCompletedHandshake = true;
    this.state.pluginMetadata = normalizeAimpPluginMetadata(message, connectedAt);
    this.state.connection.phase = 'connected';
    this.state.connection.pluginConnected = true;
    this.state.connection.protocolError = null;
    this.state.connection.disconnectReason = null;
    this.emitLog('info', 'hello', 'Handshake completed', {
      pluginName: message.payload.pluginName,
      pluginVersion: message.payload.pluginVersion,
      aimpVersion: message.payload.aimpVersion,
      instanceId: message.payload.instanceId,
      architecture: message.payload.architecture,
      platform: message.payload.platform,
    });
    logger.info('[AIMP] Handshake completed', {
      pluginVersion: message.payload.pluginVersion,
      aimpVersion: message.payload.aimpVersion,
      instanceId: message.payload.instanceId,
    });
    this.emitState();
  }

  private handlePlaylistSnapshotMessage(message: AimpPlaylistSnapshotMessage): void {
    const receivedAt = getNowIsoString();
    this.state.playlistSnapshot = normalizeAimpPlaylistSnapshot(message, receivedAt);
    this.reconcilePlaybackSnapshotWithPlaylist('playlistSnapshot');
    this.state.connection.phase = 'connected';
    this.state.connection.pluginConnected = true;
    this.state.connection.protocolError = null;
    this.emitLog('info', 'playlistSnapshot', 'Playlist snapshot received', {
      revision: message.payload.revision,
      playlistId: message.payload.playlistId,
      playlistName: message.payload.playlistName,
      trackCount: message.payload.tracks.length,
      activeTrackKey: message.payload.activeTrackKey ?? null,
      tracks: message.payload.tracks.map((t, i) => ({
        index: i,
        trackKey: t.trackKey,
        title: t.title,
        positionInQueue: t.positionInQueue,
        isActive: t.isActive,
      })),
    });
    logger.info('[AIMP] Playlist snapshot received', {
      revision: message.payload.revision,
      trackCount: message.payload.tracks.length,
    });
    this.emitState();
  }

  private handlePlaybackSnapshotMessage(message: AimpPlaybackSnapshotMessage): void {
    const receivedAt = getNowIsoString();
    this.state.playbackSnapshot = normalizeAimpPlaybackSnapshot(message, receivedAt);
    this.reconcilePlaybackSnapshotWithPlaylist('playbackSnapshot');
    this.state.connection.phase = 'connected';
    this.state.connection.pluginConnected = true;
    this.state.connection.protocolError = null;
    this.emitLog('info', 'playbackSnapshot', 'Playback snapshot received', {
      revision: message.payload.revision,
      status: message.payload.status,
      currentTrack: message.payload.currentTrack ?? null,
      currentTrackKey: message.payload.currentTrackKey ?? null,
      positionMs: message.payload.positionMs,
      durationMs: message.payload.durationMs ?? null,
      volumePercent: message.payload.volumePercent,
      isMuted: message.payload.isMuted,
    });
    logger.info('[AIMP] Playback snapshot received', {
      revision: message.payload.revision,
      status: message.payload.status,
    });
    this.emitState();
  }

  private handleHeartbeatMessage(message: AimpProtocolMessage): void {
    this.state.connection.phase = 'connected';
    this.state.connection.pluginConnected = true;
    this.state.connection.protocolError = null;
    const payload = message.type === 'heartbeat' ? message.payload : undefined;
    this.emitLog('debug', 'heartbeat', 'Heartbeat received', {
      connectionUptimeMs: payload?.connectionUptimeMs,
      lastPlaylistRevision: payload?.lastPlaylistRevision,
      lastPlaybackRevision: payload?.lastPlaybackRevision,
    });
    this.emitState();
  }

  private handleGoodbyeMessage(message: AimpGoodbyeMessage): void {
    logger.info('[AIMP] Goodbye received from plugin', message.payload);
    this.emitLog('info', 'goodbye', 'Goodbye received from plugin', {
      reason: message.payload.reason,
      detail: message.payload.detail,
    });
    const detailParts = [`reason=${message.payload.reason}`];
    if (message.payload.detail) {
      detailParts.push(message.payload.detail);
    }
    this.closeClient(
      'clientGoodbye',
      `AIMP plugin sent goodbye (${message.payload.reason}).`,
      detailParts.join('; '),
    );
  }

  private recordLiveness(isHeartbeat: boolean): void {
    const nowIso = getNowIsoString();
    this.lastLivenessAtMs = Date.now();
    this.state.connection.lastMessageAt = nowIso;
    if (isHeartbeat) {
      this.state.connection.lastHeartbeatAt = nowIso;
    }

    if (this.state.connection.phase === 'stale') {
      logger.info('[AIMP] Connection recovered from stale state');
      this.state.connection.disconnectReason = null;
    }
  }

  private closeClient(code: AimpDisconnectReason['code'], message: string, detail?: string): void {
    this.state.connection.disconnectReason = toDisconnectReason(code, message, detail);
    this.state.connection.pluginConnected = false;
    this.hasCompletedHandshake = false;
    this.lastSequence = null;
    this.lastLivenessAtMs = null;

    if (this.clientSocket) {
      this.clientSocket.removeAllListeners();
      this.clientSocket.destroy();
      this.clientSocket = null;
    }

    this.clientBuffer = '';
    this.clearLiveSnapshots({ preserveProtocolError: true });
    this.state.connection.phase = this.server ? 'listening' : 'disconnected';
    this.state.connection.appListening = Boolean(this.server);
    this.emitState();
  }

  private rejectHelloHandshake(
    disconnectCode: AimpDisconnectReason['code'],
    protocolError: AimpBridgeState['connection']['protocolError'] extends infer T
      ? Exclude<T, null>
      : never,
    helloAckErrorCode: AimpHelloAckErrorCode,
  ): void {
    this.state.connection.protocolError = protocolError;
    this.state.connection.disconnectReason = toDisconnectReason(
      disconnectCode,
      protocolError.message,
      protocolError.details,
    );

    const acknowledged = this.sendHelloAck(false, {
      errorCode: helloAckErrorCode,
      detail: formatHelloAckDetail(protocolError),
      closeAfterWrite: true,
    });

    if (!acknowledged) {
      this.closeClient(disconnectCode, protocolError.message, protocolError.details);
    }
  }

  private sendHelloAck(
    accepted: boolean,
    options?: {
      errorCode?: AimpHelloAckErrorCode;
      detail?: string;
      closeAfterWrite?: boolean;
    },
  ): boolean {
    this.serverSequence += 1;

    const message = createAimpHelloAckMessage({
      sequence: this.serverSequence,
      accepted,
      sentAt: getNowIsoString(),
      messageId: `server-helloAck-${this.serverSequence}`,
      errorCode: options?.errorCode,
      detail: options?.detail,
    });

    return this.writeServerProtocolMessage(message, options?.closeAfterWrite ?? false);
  }

  private writeServerProtocolMessage(message: object, closeAfterWrite: boolean): boolean {
    if (!this.clientSocket || this.clientSocket.destroyed) {
      return false;
    }

    const payload = `${JSON.stringify(message)}${AIMP_PROTOCOL_MESSAGE_DELIMITER}`;

    try {
      if (closeAfterWrite) {
        this.clientSocket.end(payload);
      } else {
        this.clientSocket.write(payload);
      }

      return true;
    } catch (error) {
      logger.error('[AIMP] Failed to write server protocol message', error);
      return false;
    }
  }

  private reconcilePlaybackSnapshotWithPlaylist(
    trigger: 'playlistSnapshot' | 'playbackSnapshot',
  ): void {
    const consistencyError = getAimpPlaybackPlaylistConsistencyError(
      this.state.playlistSnapshot,
      this.state.playbackSnapshot,
    );
    if (!consistencyError || this.state.playbackSnapshot === null) {
      return;
    }

    this.emitLog(
      'warn',
      'playback:reconciled',
      'Playback snapshot cleared (current track not in playlist)',
      {
        consistencyError,
        currentTrackKey: this.state.playbackSnapshot?.currentTrackKey ?? null,
        playlistRevision: this.state.playlistSnapshot?.revision ?? null,
      },
    );
    logger.warn('[AIMP] Downgrading playback snapshot due to playlist mismatch', {
      trigger,
      consistencyError,
      playlistRevision: this.state.playlistSnapshot?.revision ?? null,
      playbackRevision: this.state.playbackSnapshot.revision,
      currentTrackKey: this.state.playbackSnapshot.currentTrackKey,
    });
    this.state.playbackSnapshot = null;
  }

  private assertCanStartLiveStream(): void {
    this.refreshEnvironmentEligibility();

    if (this.state.sourceSelection !== 'aimp') {
      throw new Error('AIMP live streaming can start only when the selected source is AIMP.');
    }

    if (!this.state.environment.eligible) {
      const gatingMessage =
        this.state.environment.gatingReasons[0]?.message ??
        'AIMP environment is not eligible for live streaming.';
      throw new Error(gatingMessage);
    }

    if (
      this.state.connection.phase !== 'connected' ||
      !this.state.connection.pluginConnected ||
      !this.hasCompletedHandshake ||
      this.state.pluginMetadata === null
    ) {
      throw new Error(
        'AIMP live streaming can start only after the plugin completes a connected session handshake.',
      );
    }

    if (
      !hasUsableAimpLiveStreamSnapshots(this.state.playlistSnapshot, this.state.playbackSnapshot)
    ) {
      throw new Error(
        'AIMP live streaming can start only after usable playlist and playback snapshots are available from the connected plugin session.',
      );
    }
  }
}

function isObjectWithProtocolVersion(value: unknown): value is {
  protocolVersion: string;
} {
  return (
    typeof value === 'object' &&
    value !== null &&
    'protocolVersion' in value &&
    typeof value.protocolVersion === 'string'
  );
}

function isHelloHandshakeCandidate(value: unknown): value is {
  type: 'hello';
} {
  return typeof value === 'object' && value !== null && 'type' in value && value.type === 'hello';
}

function formatHelloAckDetail(protocolError: { message: string; details?: string }): string {
  return protocolError.details
    ? `${protocolError.message} ${protocolError.details}`
    : protocolError.message;
}

export const aimpIntegrationService = new AimpIntegrationService();
