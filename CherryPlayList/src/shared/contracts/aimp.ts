export const AIMP_PROTOCOL_VERSION = '1.0.0';
export const AIMP_PROTOCOL_PIPE_NAME = '\\\\.\\pipe\\cherryplay-aimp-v1';
// The named-pipe transport is newline-delimited JSON (one UTF-8 JSON message per line).
export const AIMP_PROTOCOL_MESSAGE_DELIMITER = '\n';
export const AIMP_HEARTBEAT_INTERVAL_MS = 5000;
export const AIMP_HEARTBEAT_STALE_TIMEOUT_MS = 15000;
export const AIMP_MAX_MESSAGE_BYTES = 2 * 1024 * 1024;

export const AIMP_SUPPORTED_PROTOCOL_VERSIONS = [AIMP_PROTOCOL_VERSION] as const;

export type AimpSourceSelection = 'cherryPlayPlayer' | 'aimp';
export type AimpConnectionPhase = 'disconnected' | 'listening' | 'connected' | 'stale';
export type AimpPlaybackStatus = 'playing' | 'paused' | 'stopped';
export type AimpProtocolMessageType =
  | 'hello'
  | 'playlistSnapshot'
  | 'playbackSnapshot'
  | 'heartbeat'
  | 'goodbye';
export type AimpProtocolServerMessageType = 'helloAck';
export type AimpTrackIdentityStrategy = 'nativeTrackId' | 'filePath' | 'titleDuration';
export type AimpHelloAckErrorCode = 'unsupportedProtocolVersion' | 'rejected';
export type AimpDisconnectReasonCode =
  | 'transportClosed'
  | 'transportError'
  | 'clientGoodbye'
  | 'heartbeatTimeout'
  | 'handshakeRequired'
  | 'protocolVersionMismatch'
  | 'malformedPayload'
  | 'sourceDisabled'
  | 'connectionReplaced'
  | 'listenFailed'
  | 'unknown';
export type AimpGatingReasonCode =
  | 'sourceNotAimp'
  | 'unsupportedPlatform'
  | 'unsupportedArchitecture'
  | 'pluginManifestMissing'
  | 'pluginManifestInvalid'
  | 'pipeListenFailed';
export type AimpProtocolErrorCode =
  | 'invalidEnvelope'
  | 'invalidType'
  | 'unsupportedProtocolVersion'
  | 'invalidPayload'
  | 'missingHandshake'
  | 'payloadTooLarge'
  | 'invalidJson';

/** Log entry for AIMP plugin interaction (main → renderer console). */
export interface AimpLogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn';
  event: string;
  message: string;
  data?: unknown;
}

export interface AimpProtocolEnvelopeBase<TType extends string, TPayload> {
  type: TType;
  protocolVersion: string;
  sequence: number;
  messageId: string;
  sentAt: string;
  payload: TPayload;
}

export interface AimpHelloPayload {
  pluginName: string;
  pluginVersion: string;
  aimpVersion: string;
  architecture: 'x64';
  platform: 'win32';
  instanceId: string;
}

export interface AimpHelloAckPayload {
  accepted: boolean;
  serverProtocolVersion: string;
  errorCode?: AimpHelloAckErrorCode;
  detail?: string;
}

export interface AimpPlaylistTrackPayload {
  /** Optional canonical key from plugin; when present and non-empty, used as track identity */
  trackKey?: string;
  nativeTrackId?: string;
  filePath?: string;
  title: string;
  artist?: string;
  album?: string;
  durationMs?: number;
  positionInQueue: number;
  isActive?: boolean;
}

export interface AimpTrackReferencePayload {
  nativeTrackId?: string;
  filePath?: string;
  title?: string;
  durationMs?: number | null;
}

export interface AimpPlaylistSnapshotPayload {
  playlistId: string;
  playlistName: string;
  revision: number;
  activeTrack?: AimpTrackReferencePayload | null;
  activeTrackKey?: string | null;
  tracks: AimpPlaylistTrackPayload[];
}

export interface AimpPlaybackSnapshotPayload {
  revision: number;
  status: AimpPlaybackStatus;
  currentTrack?: AimpTrackReferencePayload | null;
  currentTrackKey?: string | null;
  positionMs: number;
  durationMs?: number | null;
  volumePercent?: number;
  isMuted?: boolean;
}

export interface AimpHeartbeatPayload {
  connectionUptimeMs: number;
  lastPlaylistRevision?: number;
  lastPlaybackRevision?: number;
}

export interface AimpGoodbyePayload {
  reason:
    | 'pluginShutdown'
    | 'appClosing'
    | 'sourceDisabled'
    | 'protocolMismatch'
    | 'restart'
    | 'unknown';
  detail?: string;
}

export type AimpHelloMessage = AimpProtocolEnvelopeBase<'hello', AimpHelloPayload>;
export type AimpHelloAckMessage = AimpProtocolEnvelopeBase<'helloAck', AimpHelloAckPayload>;
export type AimpPlaylistSnapshotMessage = AimpProtocolEnvelopeBase<
  'playlistSnapshot',
  AimpPlaylistSnapshotPayload
>;
export type AimpPlaybackSnapshotMessage = AimpProtocolEnvelopeBase<
  'playbackSnapshot',
  AimpPlaybackSnapshotPayload
>;
export type AimpHeartbeatMessage = AimpProtocolEnvelopeBase<'heartbeat', AimpHeartbeatPayload>;
export type AimpGoodbyeMessage = AimpProtocolEnvelopeBase<'goodbye', AimpGoodbyePayload>;

export type AimpProtocolMessage =
  | AimpHelloMessage
  | AimpPlaylistSnapshotMessage
  | AimpPlaybackSnapshotMessage
  | AimpHeartbeatMessage
  | AimpGoodbyeMessage;
export type AimpProtocolServerMessage = AimpHelloAckMessage;

export interface AimpGatingReason {
  code: AimpGatingReasonCode;
  message: string;
}

export interface AimpProtocolError {
  code: AimpProtocolErrorCode;
  message: string;
  details?: string;
}

export interface AimpEnvironmentEligibility {
  eligible: boolean;
  pipeName: string;
  platform: string;
  architecture: string;
  gatingReasons: AimpGatingReason[];
}

export interface AimpPluginMetadataDto {
  pluginName: string;
  pluginVersion: string;
  aimpVersion: string;
  protocolVersion: string;
  architecture: 'x64';
  platform: 'win32';
  instanceId: string;
  connectedAt: string;
  lastHelloAt: string;
}

export interface AimpPlaylistTrackDto {
  trackKey: string;
  identityStrategy: AimpTrackIdentityStrategy;
  nativeTrackId?: string;
  filePath?: string;
  title: string;
  artist?: string;
  album?: string;
  durationMs?: number;
  order: number;
  isActive: boolean;
}

export interface AimpPlaylistSnapshotDto {
  playlistId: string;
  playlistName: string;
  revision: number;
  trackCount: number;
  activeTrackKey: string | null;
  receivedAt: string;
  sentAt: string;
  tracks: AimpPlaylistTrackDto[];
}

export interface AimpPlaybackSnapshotDto {
  revision: number;
  status: AimpPlaybackStatus;
  currentTrackKey: string | null;
  positionMs: number;
  durationMs?: number;
  volumePercent?: number;
  isMuted: boolean;
  receivedAt: string;
  sentAt: string;
}

export interface AimpConnectionStateDto {
  phase: AimpConnectionPhase;
  appListening: boolean;
  pluginConnected: boolean;
  staleAfterMs: number;
  lastMessageAt: string | null;
  lastHeartbeatAt: string | null;
  disconnectReason: AimpDisconnectReason | null;
  protocolError: AimpProtocolError | null;
}

export interface AimpDisconnectReason {
  code: AimpDisconnectReasonCode;
  message: string;
  detail?: string;
  occurredAt: string;
}

export interface AimpCompatibilityCheckpointInput {
  source: 'AIMP';
  protocolVersion: string;
  plugin: Pick<
    AimpPluginMetadataDto,
    'pluginName' | 'pluginVersion' | 'aimpVersion' | 'instanceId' | 'connectedAt'
  > | null;
  connectionPhase: AimpConnectionPhase;
  liveStreamStarted: boolean;
  playlist: Pick<
    AimpPlaylistSnapshotDto,
    'playlistId' | 'playlistName' | 'revision' | 'trackCount' | 'activeTrackKey' | 'tracks'
  > | null;
  playback: Pick<
    AimpPlaybackSnapshotDto,
    'revision' | 'status' | 'currentTrackKey' | 'positionMs' | 'durationMs'
  > | null;
}

export interface AimpBridgeState {
  protocolVersion: string;
  pipeName: string;
  sourceSelection: AimpSourceSelection;
  liveStreamStarted: boolean;
  environment: AimpEnvironmentEligibility;
  connection: AimpConnectionStateDto;
  pluginMetadata: AimpPluginMetadataDto | null;
  playlistSnapshot: AimpPlaylistSnapshotDto | null;
  playbackSnapshot: AimpPlaybackSnapshotDto | null;
  compatibilityCheckpointInput: AimpCompatibilityCheckpointInput;
}

export interface AimpValidationSuccess<T> {
  success: true;
  value: T;
}

export interface AimpValidationFailure {
  success: false;
  error: AimpProtocolError;
}

export type AimpValidationResult<T> = AimpValidationSuccess<T> | AimpValidationFailure;

interface AimpPluginManifestLike {
  name: string;
  version: string;
  protocolVersion: string;
  pipeName: string;
  supportedPlatforms: string[];
  supportedArchitectures: string[];
  main: string;
}

export type AimpPluginManifestValidationResult = AimpValidationResult<AimpPluginManifestLike>;

interface AimpEnvelopeMetadata {
  protocolVersion: string;
  sequence: number;
  messageId: string;
  sentAt: string;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function createProtocolError(
  code: AimpProtocolErrorCode,
  message: string,
  details?: string,
): AimpValidationFailure {
  return {
    success: false,
    error: {
      code,
      message,
      details,
    },
  };
}

function createSuccess<T>(value: T): AimpValidationSuccess<T> {
  return {
    success: true,
    value,
  };
}

function readString(
  record: Record<string, unknown>,
  key: string,
  message: string,
): AimpValidationResult<string> {
  const value = record[key];
  if (typeof value !== 'string' || value.trim().length === 0) {
    return createProtocolError('invalidPayload', message, `Expected non-empty string at "${key}"`);
  }

  return createSuccess(value);
}

function readValidatedOptionalString(
  record: Record<string, unknown>,
  key: string,
  message: string,
): AimpValidationResult<string | undefined> {
  if (!(key in record)) {
    return createSuccess(undefined);
  }

  const value = record[key];
  if (typeof value !== 'string' || value.trim().length === 0) {
    return createProtocolError('invalidPayload', message, `Expected non-empty string at "${key}"`);
  }

  return createSuccess(value);
}

/** Optional string: missing, null, or empty string are accepted as undefined. */
function readValidatedOptionalStringAllowEmpty(
  record: Record<string, unknown>,
  key: string,
  message: string,
): AimpValidationResult<string | undefined> {
  if (!(key in record)) {
    return createSuccess(undefined);
  }

  const value = record[key];
  if (value === null || value === undefined) {
    return createSuccess(undefined);
  }
  if (typeof value !== 'string') {
    return createProtocolError('invalidPayload', message, `Expected string at "${key}"`);
  }
  const trimmed = value.trim();
  return createSuccess(trimmed.length > 0 ? trimmed : undefined);
}

function readValidatedOptionalNullableString(
  record: Record<string, unknown>,
  key: string,
  message: string,
): AimpValidationResult<string | null | undefined> {
  if (!(key in record)) {
    return createSuccess(undefined);
  }

  const value = record[key];
  if (value === null) {
    return createSuccess(null);
  }

  if (typeof value !== 'string' || value.trim().length === 0) {
    return createProtocolError('invalidPayload', message, `Expected string or null at "${key}"`);
  }

  return createSuccess(value);
}

function readInteger(
  record: Record<string, unknown>,
  key: string,
  message: string,
): AimpValidationResult<number> {
  const value = record[key];
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    return createProtocolError(
      'invalidPayload',
      message,
      `Expected non-negative integer at "${key}"`,
    );
  }

  return createSuccess(value);
}

function readBoolean(
  record: Record<string, unknown>,
  key: string,
  message: string,
): AimpValidationResult<boolean> {
  const value = record[key];
  if (typeof value !== 'boolean') {
    return createProtocolError('invalidPayload', message, `Expected boolean at "${key}"`);
  }

  return createSuccess(value);
}

function readValidatedOptionalInteger(
  record: Record<string, unknown>,
  key: string,
  message: string,
): AimpValidationResult<number | undefined> {
  if (!(key in record)) {
    return createSuccess(undefined);
  }

  const value = record[key];
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    return createProtocolError(
      'invalidPayload',
      message,
      `Expected non-negative integer at "${key}"`,
    );
  }

  return createSuccess(value);
}

function readValidatedOptionalNullableInteger(
  record: Record<string, unknown>,
  key: string,
  message: string,
): AimpValidationResult<number | null | undefined> {
  if (!(key in record)) {
    return createSuccess(undefined);
  }

  const value = record[key];
  if (value === null) {
    return createSuccess(null);
  }

  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    return createProtocolError(
      'invalidPayload',
      message,
      `Expected non-negative integer or null at "${key}"`,
    );
  }

  return createSuccess(value);
}

function readValidatedOptionalBoolean(
  record: Record<string, unknown>,
  key: string,
  message: string,
): AimpValidationResult<boolean | undefined> {
  if (!(key in record)) {
    return createSuccess(undefined);
  }

  const value = record[key];
  if (typeof value !== 'boolean') {
    return createProtocolError('invalidPayload', message, `Expected boolean at "${key}"`);
  }

  return createSuccess(value);
}

function isValidIsoTimestamp(value: string): boolean {
  return !Number.isNaN(Date.parse(value));
}

export function isSupportedAimpProtocolVersion(version: string): boolean {
  return (AIMP_SUPPORTED_PROTOCOL_VERSIONS as readonly string[]).includes(version);
}

export function getAimpProtocolVersionError(actualVersion: string): AimpProtocolError {
  return {
    code: 'unsupportedProtocolVersion',
    message: `Unsupported AIMP protocol version "${actualVersion}"`,
    details: `Supported versions: ${AIMP_SUPPORTED_PROTOCOL_VERSIONS.join(', ')}`,
  };
}

export function createAimpHelloAckMessage(options: {
  sequence: number;
  accepted: boolean;
  sentAt: string;
  messageId?: string;
  serverProtocolVersion?: string;
  errorCode?: AimpHelloAckErrorCode;
  detail?: string;
}): AimpHelloAckMessage {
  const payload: AimpHelloAckPayload = {
    accepted: options.accepted,
    serverProtocolVersion: options.serverProtocolVersion ?? AIMP_PROTOCOL_VERSION,
  };

  if (options.errorCode !== undefined) {
    payload.errorCode = options.errorCode;
  }

  if (options.detail !== undefined) {
    payload.detail = options.detail;
  }

  return {
    type: 'helloAck',
    protocolVersion: AIMP_PROTOCOL_VERSION,
    sequence: options.sequence,
    messageId: options.messageId ?? `helloAck-${options.sequence}`,
    sentAt: options.sentAt,
    payload,
  };
}

function readIsoTimestamp(
  record: Record<string, unknown>,
  key: string,
  message: string,
): AimpValidationResult<string> {
  const result = readString(record, key, message);
  if (!result.success) {
    return result;
  }

  if (!isValidIsoTimestamp(result.value)) {
    return createProtocolError('invalidPayload', message, `Expected ISO timestamp at "${key}"`);
  }

  return result;
}

function readOptionalNullableIsoTimestamp(
  record: Record<string, unknown>,
  key: string,
  message: string,
): AimpValidationResult<string | null> {
  const result = readValidatedOptionalNullableString(record, key, message);
  if (!result.success) {
    return result;
  }

  if (result.value === undefined) {
    return createProtocolError('invalidPayload', message, `Expected string or null at "${key}"`);
  }

  if (result.value !== null && !isValidIsoTimestamp(result.value)) {
    return createProtocolError('invalidPayload', message, `Expected ISO timestamp at "${key}"`);
  }

  return createSuccess(result.value);
}

function validateAimpGatingReason(
  value: unknown,
  messagePrefix: string,
): AimpValidationResult<AimpGatingReason> {
  if (!isPlainObject(value)) {
    return createProtocolError('invalidPayload', `${messagePrefix} must be an object`);
  }

  const code = readString(value, 'code', `${messagePrefix} code is required`);
  if (!code.success) {
    return code;
  }

  if (
    ![
      'sourceNotAimp',
      'unsupportedPlatform',
      'unsupportedArchitecture',
      'pluginManifestMissing',
      'pluginManifestInvalid',
      'pipeListenFailed',
    ].includes(code.value)
  ) {
    return createProtocolError('invalidPayload', `${messagePrefix} code is invalid`, code.value);
  }

  const message = readString(value, 'message', `${messagePrefix} message is required`);
  if (!message.success) {
    return message;
  }

  return createSuccess({
    code: code.value as AimpGatingReasonCode,
    message: message.value,
  });
}

function validateAimpProtocolErrorState(
  value: unknown,
  messagePrefix: string,
): AimpValidationResult<AimpProtocolError | null> {
  if (value === null) {
    return createSuccess(null);
  }

  if (!isPlainObject(value)) {
    return createProtocolError('invalidPayload', `${messagePrefix} must be an object or null`);
  }

  const code = readString(value, 'code', `${messagePrefix} code is required`);
  if (!code.success) {
    return code;
  }

  if (
    ![
      'invalidEnvelope',
      'invalidType',
      'unsupportedProtocolVersion',
      'invalidPayload',
      'missingHandshake',
      'payloadTooLarge',
      'invalidJson',
    ].includes(code.value)
  ) {
    return createProtocolError('invalidPayload', `${messagePrefix} code is invalid`, code.value);
  }

  const message = readString(value, 'message', `${messagePrefix} message is required`);
  if (!message.success) {
    return message;
  }

  const details = readValidatedOptionalString(
    value,
    'details',
    `${messagePrefix} details must be a non-empty string when provided`,
  );
  if (!details.success) {
    return details;
  }

  return createSuccess({
    code: code.value as AimpProtocolErrorCode,
    message: message.value,
    details: details.value,
  });
}

function validateAimpDisconnectReasonState(
  value: unknown,
  messagePrefix: string,
): AimpValidationResult<AimpDisconnectReason | null> {
  if (value === null) {
    return createSuccess(null);
  }

  if (!isPlainObject(value)) {
    return createProtocolError('invalidPayload', `${messagePrefix} must be an object or null`);
  }

  const code = readString(value, 'code', `${messagePrefix} code is required`);
  if (!code.success) {
    return code;
  }

  if (
    ![
      'transportClosed',
      'transportError',
      'clientGoodbye',
      'heartbeatTimeout',
      'handshakeRequired',
      'protocolVersionMismatch',
      'malformedPayload',
      'sourceDisabled',
      'connectionReplaced',
      'listenFailed',
      'unknown',
    ].includes(code.value)
  ) {
    return createProtocolError('invalidPayload', `${messagePrefix} code is invalid`, code.value);
  }

  const message = readString(value, 'message', `${messagePrefix} message is required`);
  if (!message.success) {
    return message;
  }

  // Treat absent or empty detail as undefined so IPC/structured-clone never fails validation
  let detailValue: string | undefined;
  if (!('detail' in value) || value.detail === undefined || value.detail === null) {
    detailValue = undefined;
  } else if (typeof value.detail === 'string') {
    const trimmed = value.detail.trim();
    detailValue = trimmed.length > 0 ? trimmed : undefined;
  } else {
    return createProtocolError(
      'invalidPayload',
      `${messagePrefix} detail must be a string when provided`,
    );
  }

  const occurredAt = readIsoTimestamp(
    value,
    'occurredAt',
    `${messagePrefix} occurredAt is required`,
  );
  if (!occurredAt.success) {
    return occurredAt;
  }

  return createSuccess({
    code: code.value as AimpDisconnectReasonCode,
    message: message.value,
    detail: detailValue,
    occurredAt: occurredAt.value,
  });
}

function validateAimpEnvironmentEligibility(
  value: unknown,
): AimpValidationResult<AimpEnvironmentEligibility> {
  if (!isPlainObject(value)) {
    return createProtocolError('invalidPayload', 'AIMP bridge state environment must be an object');
  }

  const eligible = readBoolean(value, 'eligible', 'AIMP environment eligible is required');
  if (!eligible.success) {
    return eligible;
  }

  const pipeName = readString(value, 'pipeName', 'AIMP environment pipeName is required');
  if (!pipeName.success) {
    return pipeName;
  }

  const platform = readString(value, 'platform', 'AIMP environment platform is required');
  if (!platform.success) {
    return platform;
  }

  const architecture = readString(
    value,
    'architecture',
    'AIMP environment architecture is required',
  );
  if (!architecture.success) {
    return architecture;
  }

  if (!Array.isArray(value.gatingReasons)) {
    return createProtocolError('invalidPayload', 'AIMP environment gatingReasons must be an array');
  }

  const gatingReasons: AimpGatingReason[] = [];
  for (const [index, reasonValue] of value.gatingReasons.entries()) {
    const reason = validateAimpGatingReason(
      reasonValue,
      `AIMP environment gatingReason at index ${index}`,
    );
    if (!reason.success) {
      return reason;
    }

    gatingReasons.push(reason.value);
  }

  if (eligible.value && gatingReasons.length > 0) {
    return createProtocolError(
      'invalidPayload',
      'AIMP environment cannot be eligible while gatingReasons are present',
    );
  }

  return createSuccess({
    eligible: eligible.value,
    pipeName: pipeName.value,
    platform: platform.value,
    architecture: architecture.value,
    gatingReasons,
  });
}

function validateAimpConnectionState(value: unknown): AimpValidationResult<AimpConnectionStateDto> {
  if (!isPlainObject(value)) {
    return createProtocolError('invalidPayload', 'AIMP bridge state connection must be an object');
  }

  const phase = readString(value, 'phase', 'AIMP connection phase is required');
  if (!phase.success) {
    return phase;
  }

  if (!['disconnected', 'listening', 'connected', 'stale'].includes(phase.value)) {
    return createProtocolError(
      'invalidPayload',
      'AIMP bridge state connection.phase is invalid',
      phase.value,
    );
  }

  const appListening = readBoolean(
    value,
    'appListening',
    'AIMP connection appListening is required',
  );
  if (!appListening.success) {
    return appListening;
  }

  const pluginConnected = readBoolean(
    value,
    'pluginConnected',
    'AIMP connection pluginConnected is required',
  );
  if (!pluginConnected.success) {
    return pluginConnected;
  }

  const staleAfterMs = readInteger(
    value,
    'staleAfterMs',
    'AIMP connection staleAfterMs is required',
  );
  if (!staleAfterMs.success) {
    return staleAfterMs;
  }

  const lastMessageAt = readOptionalNullableIsoTimestamp(
    value,
    'lastMessageAt',
    'AIMP connection lastMessageAt must be an ISO timestamp or null',
  );
  if (!lastMessageAt.success) {
    return lastMessageAt;
  }

  const lastHeartbeatAt = readOptionalNullableIsoTimestamp(
    value,
    'lastHeartbeatAt',
    'AIMP connection lastHeartbeatAt must be an ISO timestamp or null',
  );
  if (!lastHeartbeatAt.success) {
    return lastHeartbeatAt;
  }

  const disconnectReason = validateAimpDisconnectReasonState(
    'disconnectReason' in value ? value.disconnectReason : null,
    'AIMP connection disconnectReason',
  );
  if (!disconnectReason.success) {
    return disconnectReason;
  }

  const protocolError = validateAimpProtocolErrorState(
    'protocolError' in value ? value.protocolError : null,
    'AIMP connection protocolError',
  );
  if (!protocolError.success) {
    return protocolError;
  }

  if (phase.value === 'disconnected' && pluginConnected.value) {
    return createProtocolError(
      'invalidPayload',
      'AIMP disconnected state cannot report pluginConnected=true',
    );
  }

  if (phase.value === 'listening' && !appListening.value) {
    return createProtocolError(
      'invalidPayload',
      'AIMP listening state must report appListening=true',
    );
  }

  if ((phase.value === 'connected' || phase.value === 'stale') && !pluginConnected.value) {
    return createProtocolError(
      'invalidPayload',
      `AIMP ${phase.value} state must report pluginConnected=true`,
    );
  }

  if ((phase.value === 'connected' || phase.value === 'stale') && !appListening.value) {
    return createProtocolError(
      'invalidPayload',
      `AIMP ${phase.value} state must report appListening=true`,
    );
  }

  return createSuccess({
    phase: phase.value as AimpConnectionPhase,
    appListening: appListening.value,
    pluginConnected: pluginConnected.value,
    staleAfterMs: staleAfterMs.value,
    lastMessageAt: lastMessageAt.value,
    lastHeartbeatAt: lastHeartbeatAt.value,
    disconnectReason: disconnectReason.value,
    protocolError: protocolError.value,
  });
}

function validateAimpPluginMetadataState(
  value: unknown,
): AimpValidationResult<AimpPluginMetadataDto | null> {
  if (value === null) {
    return createSuccess(null);
  }

  if (!isPlainObject(value)) {
    return createProtocolError(
      'invalidPayload',
      'AIMP bridge state pluginMetadata must be an object or null',
    );
  }

  const pluginName = readString(
    value,
    'pluginName',
    'AIMP bridge state pluginMetadata.pluginName is required',
  );
  if (!pluginName.success) {
    return pluginName;
  }

  const pluginVersion = readString(
    value,
    'pluginVersion',
    'AIMP bridge state pluginMetadata.pluginVersion is required',
  );
  if (!pluginVersion.success) {
    return pluginVersion;
  }

  const aimpVersion = readString(
    value,
    'aimpVersion',
    'AIMP bridge state pluginMetadata.aimpVersion is required',
  );
  if (!aimpVersion.success) {
    return aimpVersion;
  }

  const protocolVersion = readString(
    value,
    'protocolVersion',
    'AIMP bridge state pluginMetadata.protocolVersion is required',
  );
  if (!protocolVersion.success) {
    return protocolVersion;
  }

  if (!isSupportedAimpProtocolVersion(protocolVersion.value)) {
    return {
      success: false,
      error: getAimpProtocolVersionError(protocolVersion.value),
    };
  }

  const architecture = readString(
    value,
    'architecture',
    'AIMP bridge state pluginMetadata.architecture is required',
  );
  if (!architecture.success) {
    return architecture;
  }

  if (architecture.value !== 'x64') {
    return createProtocolError(
      'invalidPayload',
      'AIMP bridge state pluginMetadata.architecture must be "x64"',
      architecture.value,
    );
  }

  const platform = readString(
    value,
    'platform',
    'AIMP bridge state pluginMetadata.platform is required',
  );
  if (!platform.success) {
    return platform;
  }

  if (platform.value !== 'win32') {
    return createProtocolError(
      'invalidPayload',
      'AIMP bridge state pluginMetadata.platform must be "win32"',
      platform.value,
    );
  }

  const instanceId = readString(
    value,
    'instanceId',
    'AIMP bridge state pluginMetadata.instanceId is required',
  );
  if (!instanceId.success) {
    return instanceId;
  }

  const connectedAt = readIsoTimestamp(
    value,
    'connectedAt',
    'AIMP bridge state pluginMetadata.connectedAt is required',
  );
  if (!connectedAt.success) {
    return connectedAt;
  }

  const lastHelloAt = readIsoTimestamp(
    value,
    'lastHelloAt',
    'AIMP bridge state pluginMetadata.lastHelloAt is required',
  );
  if (!lastHelloAt.success) {
    return lastHelloAt;
  }

  return createSuccess({
    pluginName: pluginName.value,
    pluginVersion: pluginVersion.value,
    aimpVersion: aimpVersion.value,
    protocolVersion: protocolVersion.value,
    architecture: 'x64',
    platform: 'win32',
    instanceId: instanceId.value,
    connectedAt: connectedAt.value,
    lastHelloAt: lastHelloAt.value,
  });
}

function validateAimpPlaylistTrackDtoState(
  value: unknown,
  messagePrefix: string,
): AimpValidationResult<AimpPlaylistTrackDto> {
  if (!isPlainObject(value)) {
    return createProtocolError('invalidPayload', `${messagePrefix} must be an object`);
  }

  const normalizedValue = omitUndefinedDeep(value);

  const trackKey = readString(normalizedValue, 'trackKey', `${messagePrefix} trackKey is required`);
  if (!trackKey.success) {
    return trackKey;
  }

  const identityStrategy = readString(
    normalizedValue,
    'identityStrategy',
    `${messagePrefix} identityStrategy is required`,
  );
  if (!identityStrategy.success) {
    return identityStrategy;
  }

  if (!['nativeTrackId', 'filePath', 'titleDuration'].includes(identityStrategy.value)) {
    return createProtocolError(
      'invalidPayload',
      `${messagePrefix} identityStrategy is invalid`,
      identityStrategy.value,
    );
  }

  const nativeTrackId = readValidatedOptionalString(
    normalizedValue,
    'nativeTrackId',
    `${messagePrefix} nativeTrackId must be a non-empty string when provided`,
  );
  if (!nativeTrackId.success) {
    return nativeTrackId;
  }

  const filePath = readValidatedOptionalString(
    normalizedValue,
    'filePath',
    `${messagePrefix} filePath must be a non-empty string when provided`,
  );
  if (!filePath.success) {
    return filePath;
  }

  const title = readString(normalizedValue, 'title', `${messagePrefix} title is required`);
  if (!title.success) {
    return title;
  }

  const artist = readValidatedOptionalString(
    normalizedValue,
    'artist',
    `${messagePrefix} artist must be a non-empty string when provided`,
  );
  if (!artist.success) {
    return artist;
  }

  const album = readValidatedOptionalString(
    normalizedValue,
    'album',
    `${messagePrefix} album must be a non-empty string when provided`,
  );
  if (!album.success) {
    return album;
  }

  const durationMs = readValidatedOptionalInteger(
    normalizedValue,
    'durationMs',
    `${messagePrefix} durationMs must be a non-negative integer when provided`,
  );
  if (!durationMs.success) {
    return durationMs;
  }

  const order = readInteger(normalizedValue, 'order', `${messagePrefix} order is required`);
  if (!order.success) {
    return order;
  }

  const isActive = readBoolean(
    normalizedValue,
    'isActive',
    `${messagePrefix} isActive is required`,
  );
  if (!isActive.success) {
    return isActive;
  }

  if (identityStrategy.value === 'nativeTrackId' && !nativeTrackId.value) {
    return createProtocolError(
      'invalidPayload',
      `${messagePrefix} identityStrategy nativeTrackId requires nativeTrackId`,
    );
  }

  if (identityStrategy.value === 'filePath' && !filePath.value) {
    return createProtocolError(
      'invalidPayload',
      `${messagePrefix} identityStrategy filePath requires filePath`,
    );
  }

  if (identityStrategy.value === 'titleDuration' && durationMs.value === undefined) {
    return createProtocolError(
      'invalidPayload',
      `${messagePrefix} identityStrategy titleDuration requires durationMs`,
    );
  }

  return createSuccess({
    trackKey: trackKey.value,
    identityStrategy: identityStrategy.value as AimpTrackIdentityStrategy,
    nativeTrackId: nativeTrackId.value,
    filePath: filePath.value,
    title: title.value,
    artist: artist.value,
    album: album.value,
    durationMs: durationMs.value,
    order: order.value,
    isActive: isActive.value,
  });
}

function validateAimpPlaylistSnapshotState(
  value: unknown,
): AimpValidationResult<AimpPlaylistSnapshotDto | null> {
  if (value === null) {
    return createSuccess(null);
  }

  if (!isPlainObject(value)) {
    return createProtocolError(
      'invalidPayload',
      'AIMP bridge state playlistSnapshot must be an object or null',
    );
  }

  const normalizedValue = omitUndefinedDeep(value);

  const playlistId = readString(
    normalizedValue,
    'playlistId',
    'AIMP bridge state playlistSnapshot.playlistId is required',
  );
  if (!playlistId.success) {
    return playlistId;
  }

  const playlistName = readString(
    normalizedValue,
    'playlistName',
    'AIMP bridge state playlistSnapshot.playlistName is required',
  );
  if (!playlistName.success) {
    return playlistName;
  }

  const revision = readInteger(
    normalizedValue,
    'revision',
    'AIMP bridge state playlistSnapshot.revision is required',
  );
  if (!revision.success) {
    return revision;
  }

  const trackCount = readInteger(
    normalizedValue,
    'trackCount',
    'AIMP bridge state playlistSnapshot.trackCount is required',
  );
  if (!trackCount.success) {
    return trackCount;
  }

  const activeTrackKey = readValidatedOptionalNullableString(
    normalizedValue,
    'activeTrackKey',
    'AIMP bridge state playlistSnapshot.activeTrackKey must be a string or null',
  );
  if (!activeTrackKey.success) {
    return activeTrackKey;
  }

  const receivedAt = readIsoTimestamp(
    normalizedValue,
    'receivedAt',
    'AIMP bridge state playlistSnapshot.receivedAt is required',
  );
  if (!receivedAt.success) {
    return receivedAt;
  }

  const sentAt = readIsoTimestamp(
    normalizedValue,
    'sentAt',
    'AIMP bridge state playlistSnapshot.sentAt is required',
  );
  if (!sentAt.success) {
    return sentAt;
  }

  if (!Array.isArray(normalizedValue.tracks)) {
    return createProtocolError(
      'invalidPayload',
      'AIMP bridge state playlistSnapshot.tracks must be an array',
    );
  }

  const tracks: AimpPlaylistTrackDto[] = [];
  for (const [index, trackValue] of normalizedValue.tracks.entries()) {
    const track = validateAimpPlaylistTrackDtoState(
      trackValue,
      `AIMP bridge state playlistSnapshot track at index ${index}`,
    );
    if (!track.success) {
      return track;
    }

    tracks.push(track.value);
  }

  if (trackCount.value !== tracks.length) {
    return createProtocolError(
      'invalidPayload',
      'AIMP bridge state playlistSnapshot.trackCount must match tracks length',
    );
  }

  const activeTracks = tracks.filter((track) => track.isActive);
  if (activeTracks.length > 1) {
    return createProtocolError(
      'invalidPayload',
      'AIMP bridge state playlistSnapshot cannot mark more than one track active',
    );
  }

  if (
    activeTrackKey.value !== undefined &&
    activeTrackKey.value !== null &&
    !tracks.some((track) => track.trackKey === activeTrackKey.value)
  ) {
    return createProtocolError(
      'invalidPayload',
      'AIMP bridge state playlistSnapshot.activeTrackKey must exist in tracks',
      activeTrackKey.value,
    );
  }

  if (
    activeTrackKey.value !== undefined &&
    activeTrackKey.value !== null &&
    activeTracks.length === 1 &&
    activeTracks[0].trackKey !== activeTrackKey.value
  ) {
    return createProtocolError(
      'invalidPayload',
      'AIMP bridge state playlistSnapshot active track must match activeTrackKey',
    );
  }

  return createSuccess({
    playlistId: playlistId.value,
    playlistName: playlistName.value,
    revision: revision.value,
    trackCount: trackCount.value,
    activeTrackKey: activeTrackKey.value ?? null,
    receivedAt: receivedAt.value,
    sentAt: sentAt.value,
    tracks,
  });
}

function validateAimpPlaybackSnapshotState(
  value: unknown,
): AimpValidationResult<AimpPlaybackSnapshotDto | null> {
  if (value === null) {
    return createSuccess(null);
  }

  if (!isPlainObject(value)) {
    return createProtocolError(
      'invalidPayload',
      'AIMP bridge state playbackSnapshot must be an object or null',
    );
  }

  const normalizedValue = omitUndefinedDeep(value);

  const revision = readInteger(
    normalizedValue,
    'revision',
    'AIMP bridge state playbackSnapshot.revision is required',
  );
  if (!revision.success) {
    return revision;
  }

  const status = readString(
    normalizedValue,
    'status',
    'AIMP bridge state playbackSnapshot.status is required',
  );
  if (!status.success) {
    return status;
  }

  if (!['playing', 'paused', 'stopped'].includes(status.value)) {
    return createProtocolError(
      'invalidPayload',
      'AIMP bridge state playbackSnapshot.status is invalid',
      status.value,
    );
  }

  const currentTrackKey = readValidatedOptionalNullableString(
    normalizedValue,
    'currentTrackKey',
    'AIMP bridge state playbackSnapshot.currentTrackKey must be a string or null',
  );
  if (!currentTrackKey.success) {
    return currentTrackKey;
  }

  const positionMs = readInteger(
    normalizedValue,
    'positionMs',
    'AIMP bridge state playbackSnapshot.positionMs is required',
  );
  if (!positionMs.success) {
    return positionMs;
  }

  const durationMs = readValidatedOptionalInteger(
    normalizedValue,
    'durationMs',
    'AIMP bridge state playbackSnapshot.durationMs must be a non-negative integer when provided',
  );
  if (!durationMs.success) {
    return durationMs;
  }

  const volumePercent = readValidatedOptionalInteger(
    normalizedValue,
    'volumePercent',
    'AIMP bridge state playbackSnapshot.volumePercent must be a non-negative integer when provided',
  );
  if (!volumePercent.success) {
    return volumePercent;
  }

  if (volumePercent.value !== undefined && volumePercent.value > 100) {
    return createProtocolError(
      'invalidPayload',
      'AIMP bridge state playbackSnapshot.volumePercent must be between 0 and 100',
    );
  }

  const isMuted = readBoolean(
    normalizedValue,
    'isMuted',
    'AIMP bridge state playbackSnapshot.isMuted is required',
  );
  if (!isMuted.success) {
    return isMuted;
  }

  const receivedAt = readIsoTimestamp(
    normalizedValue,
    'receivedAt',
    'AIMP bridge state playbackSnapshot.receivedAt is required',
  );
  if (!receivedAt.success) {
    return receivedAt;
  }

  const sentAt = readIsoTimestamp(
    normalizedValue,
    'sentAt',
    'AIMP bridge state playbackSnapshot.sentAt is required',
  );
  if (!sentAt.success) {
    return sentAt;
  }

  return createSuccess({
    revision: revision.value,
    status: status.value as AimpPlaybackStatus,
    currentTrackKey: currentTrackKey.value ?? null,
    positionMs: positionMs.value,
    durationMs: durationMs.value,
    volumePercent: volumePercent.value,
    isMuted: isMuted.value,
    receivedAt: receivedAt.value,
    sentAt: sentAt.value,
  });
}

function validateAimpCompatibilityCheckpointInputState(
  value: unknown,
): AimpValidationResult<AimpCompatibilityCheckpointInput> {
  if (!isPlainObject(value)) {
    return createProtocolError(
      'invalidPayload',
      'AIMP bridge state compatibilityCheckpointInput must be an object',
    );
  }

  const source = readString(
    value,
    'source',
    'AIMP compatibilityCheckpointInput source is required',
  );
  if (!source.success) {
    return source;
  }

  if (source.value !== 'AIMP') {
    return createProtocolError(
      'invalidPayload',
      'AIMP compatibilityCheckpointInput source must be "AIMP"',
      source.value,
    );
  }

  const protocolVersion = readString(
    value,
    'protocolVersion',
    'AIMP compatibilityCheckpointInput protocolVersion is required',
  );
  if (!protocolVersion.success) {
    return protocolVersion;
  }

  if (!isSupportedAimpProtocolVersion(protocolVersion.value)) {
    return {
      success: false,
      error: getAimpProtocolVersionError(protocolVersion.value),
    };
  }

  const connectionPhase = readString(
    value,
    'connectionPhase',
    'AIMP compatibilityCheckpointInput connectionPhase is required',
  );
  if (!connectionPhase.success) {
    return connectionPhase;
  }

  if (!['disconnected', 'listening', 'connected', 'stale'].includes(connectionPhase.value)) {
    return createProtocolError(
      'invalidPayload',
      'AIMP compatibilityCheckpointInput connectionPhase is invalid',
      connectionPhase.value,
    );
  }

  const liveStreamStarted = readBoolean(
    value,
    'liveStreamStarted',
    'AIMP compatibilityCheckpointInput liveStreamStarted is required',
  );
  if (!liveStreamStarted.success) {
    return liveStreamStarted;
  }

  let plugin: AimpCompatibilityCheckpointInput['plugin'] = null;
  if (value.plugin !== null && value.plugin !== undefined) {
    if (!isPlainObject(value.plugin)) {
      return createProtocolError(
        'invalidPayload',
        'AIMP compatibilityCheckpointInput plugin must be an object or null',
      );
    }

    const pluginName = readString(
      value.plugin,
      'pluginName',
      'AIMP compatibilityCheckpointInput plugin.pluginName is required',
    );
    if (!pluginName.success) {
      return pluginName;
    }

    const pluginVersion = readString(
      value.plugin,
      'pluginVersion',
      'AIMP compatibilityCheckpointInput plugin.pluginVersion is required',
    );
    if (!pluginVersion.success) {
      return pluginVersion;
    }

    const aimpVersion = readString(
      value.plugin,
      'aimpVersion',
      'AIMP compatibilityCheckpointInput plugin.aimpVersion is required',
    );
    if (!aimpVersion.success) {
      return aimpVersion;
    }

    const instanceId = readString(
      value.plugin,
      'instanceId',
      'AIMP compatibilityCheckpointInput plugin.instanceId is required',
    );
    if (!instanceId.success) {
      return instanceId;
    }

    const connectedAt = readIsoTimestamp(
      value.plugin,
      'connectedAt',
      'AIMP compatibilityCheckpointInput plugin.connectedAt is required',
    );
    if (!connectedAt.success) {
      return connectedAt;
    }

    plugin = {
      pluginName: pluginName.value,
      pluginVersion: pluginVersion.value,
      aimpVersion: aimpVersion.value,
      instanceId: instanceId.value,
      connectedAt: connectedAt.value,
    };
  } else if (value.plugin === undefined) {
    return createProtocolError(
      'invalidPayload',
      'AIMP compatibilityCheckpointInput plugin must be an object or null',
    );
  }

  let playlist: AimpCompatibilityCheckpointInput['playlist'] = null;
  if (value.playlist !== null && value.playlist !== undefined) {
    const playlistState = validateAimpPlaylistSnapshotState({
      ...omitUndefinedDeep(value.playlist as Record<string, unknown>),
      receivedAt: '1970-01-01T00:00:00.000Z',
      sentAt: '1970-01-01T00:00:00.000Z',
    });
    if (!playlistState.success) {
      return createProtocolError(
        'invalidPayload',
        'AIMP compatibilityCheckpointInput playlist is invalid',
        playlistState.error.message,
      );
    }

    const normalizedPlaylist = playlistState.value;
    if (normalizedPlaylist === null) {
      return createProtocolError(
        'invalidPayload',
        'AIMP compatibilityCheckpointInput playlist must be an object or null',
      );
    }

    playlist = {
      playlistId: normalizedPlaylist.playlistId,
      playlistName: normalizedPlaylist.playlistName,
      revision: normalizedPlaylist.revision,
      trackCount: normalizedPlaylist.trackCount,
      activeTrackKey: normalizedPlaylist.activeTrackKey,
      tracks: normalizedPlaylist.tracks,
    };
  } else if (value.playlist === undefined) {
    return createProtocolError(
      'invalidPayload',
      'AIMP compatibilityCheckpointInput playlist must be an object or null',
    );
  }

  let playback: AimpCompatibilityCheckpointInput['playback'] = null;
  if (value.playback !== null && value.playback !== undefined) {
    const playbackState = validateAimpPlaybackSnapshotState({
      ...omitUndefinedDeep(value.playback as Record<string, unknown>),
      receivedAt: '1970-01-01T00:00:00.000Z',
      sentAt: '1970-01-01T00:00:00.000Z',
      isMuted: false,
    });
    if (!playbackState.success) {
      return createProtocolError(
        'invalidPayload',
        'AIMP compatibilityCheckpointInput playback is invalid',
        playbackState.error.message,
      );
    }

    const normalizedPlayback = playbackState.value;
    if (normalizedPlayback === null) {
      return createProtocolError(
        'invalidPayload',
        'AIMP compatibilityCheckpointInput playback must be an object or null',
      );
    }

    playback = {
      revision: normalizedPlayback.revision,
      status: normalizedPlayback.status,
      currentTrackKey: normalizedPlayback.currentTrackKey,
      positionMs: normalizedPlayback.positionMs,
      durationMs: normalizedPlayback.durationMs,
    };
  } else if (value.playback === undefined) {
    return createProtocolError(
      'invalidPayload',
      'AIMP compatibilityCheckpointInput playback must be an object or null',
    );
  }

  return createSuccess({
    source: 'AIMP',
    protocolVersion: protocolVersion.value,
    plugin,
    connectionPhase: connectionPhase.value as AimpConnectionPhase,
    liveStreamStarted: liveStreamStarted.value,
    playlist,
    playback,
  });
}

function areJsonEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function omitUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => omitUndefinedDeep(item)) as T;
  }

  if (isPlainObject(value)) {
    const nextValue: Record<string, unknown> = {};
    for (const [key, nestedValue] of Object.entries(value)) {
      if (nestedValue !== undefined) {
        nextValue[key] = omitUndefinedDeep(nestedValue);
      }
    }

    return nextValue as T;
  }

  return value;
}

function playlistContainsTrackKey(
  playlistSnapshot: Pick<AimpPlaylistSnapshotDto, 'tracks'> | null,
  trackKey: string,
): boolean {
  if (!playlistSnapshot?.tracks.length) {
    return false;
  }
  const normalizedKey = normalizeTrackKeyForComparison(trackKey);
  return playlistSnapshot.tracks.some(
    (track) => normalizeTrackKeyForComparison(track.trackKey) === normalizedKey,
  );
}

export function getAimpPlaybackPlaylistConsistencyError(
  playlistSnapshot: Pick<AimpPlaylistSnapshotDto, 'tracks'> | null,
  playbackSnapshot: Pick<AimpPlaybackSnapshotDto, 'currentTrackKey'> | null,
): string | null {
  const currentTrackKey = playbackSnapshot?.currentTrackKey ?? null;
  if (playlistSnapshot === null || currentTrackKey === null) {
    return null;
  }

  if (playlistContainsTrackKey(playlistSnapshot, currentTrackKey)) {
    return null;
  }

  return 'AIMP playbackSnapshot.currentTrackKey must exist in the latest accepted playlistSnapshot.tracks';
}

export function hasUsableAimpLiveStreamSnapshots(
  playlistSnapshot: AimpPlaylistSnapshotDto | null,
  playbackSnapshot: AimpPlaybackSnapshotDto | null,
): boolean {
  return (
    playlistSnapshot !== null &&
    playbackSnapshot !== null &&
    getAimpPlaybackPlaylistConsistencyError(playlistSnapshot, playbackSnapshot) === null
  );
}

export function validateAimpPluginManifest(value: unknown): AimpPluginManifestValidationResult {
  if (!isPlainObject(value)) {
    return createProtocolError('invalidPayload', 'AIMP manifest must be an object');
  }

  const name = readString(value, 'name', 'AIMP manifest name is required');
  if (!name.success) {
    return name;
  }

  const version = readString(value, 'version', 'AIMP manifest version is required');
  if (!version.success) {
    return version;
  }

  const protocolVersion = readString(
    value,
    'protocolVersion',
    'AIMP manifest protocolVersion is required',
  );
  if (!protocolVersion.success) {
    return protocolVersion;
  }

  const pipeName = readString(value, 'pipeName', 'AIMP manifest pipeName is required');
  if (!pipeName.success) {
    return pipeName;
  }

  const main = readString(value, 'main', 'AIMP manifest main is required');
  if (!main.success) {
    return main;
  }

  const supportedPlatforms = value.supportedPlatforms;
  if (
    !Array.isArray(supportedPlatforms) ||
    supportedPlatforms.length === 0 ||
    supportedPlatforms.some((item) => typeof item !== 'string' || item.length === 0)
  ) {
    return createProtocolError(
      'invalidPayload',
      'AIMP manifest supportedPlatforms must be a non-empty string array',
    );
  }

  const supportedArchitectures = value.supportedArchitectures;
  if (
    !Array.isArray(supportedArchitectures) ||
    supportedArchitectures.length === 0 ||
    supportedArchitectures.some((item) => typeof item !== 'string' || item.length === 0)
  ) {
    return createProtocolError(
      'invalidPayload',
      'AIMP manifest supportedArchitectures must be a non-empty string array',
    );
  }

  return createSuccess({
    name: name.value,
    version: version.value,
    protocolVersion: protocolVersion.value,
    pipeName: pipeName.value,
    supportedPlatforms,
    supportedArchitectures,
    main: main.value,
  });
}

function validateTrackReferencePayload(
  value: unknown,
  key: string,
  message: string,
): AimpValidationResult<AimpTrackReferencePayload | null | undefined> {
  if (!(key in (value as Record<string, unknown>))) {
    return createSuccess(undefined);
  }

  const referenceValue = (value as Record<string, unknown>)[key];
  if (referenceValue === null) {
    return createSuccess(null);
  }

  if (!isPlainObject(referenceValue)) {
    return createProtocolError('invalidPayload', message, `Expected object or null at "${key}"`);
  }

  const nativeTrackId = readValidatedOptionalString(
    referenceValue,
    'nativeTrackId',
    `${message}: nativeTrackId must be a non-empty string when provided`,
  );
  if (!nativeTrackId.success) {
    return nativeTrackId;
  }

  const filePath = readValidatedOptionalString(
    referenceValue,
    'filePath',
    `${message}: filePath must be a non-empty string when provided`,
  );
  if (!filePath.success) {
    return filePath;
  }

  const title = readValidatedOptionalString(
    referenceValue,
    'title',
    `${message}: title must be a non-empty string when provided`,
  );
  if (!title.success) {
    return title;
  }

  const durationMs = readValidatedOptionalNullableInteger(
    referenceValue,
    'durationMs',
    `${message}: durationMs must be a non-negative integer or null when provided`,
  );
  if (!durationMs.success) {
    return durationMs;
  }

  const hasNativeTrackId = nativeTrackId.value !== undefined;
  const hasFilePath = filePath.value !== undefined;
  const hasTitleDurationFallback =
    title.value !== undefined && typeof durationMs.value === 'number';

  if (!hasNativeTrackId && !hasFilePath && !hasTitleDurationFallback) {
    return createProtocolError(
      'invalidPayload',
      message,
      `Track reference "${key}" must include nativeTrackId, filePath, or title + durationMs`,
    );
  }

  if (title.value !== undefined && durationMs.value === null) {
    return createProtocolError(
      'invalidPayload',
      message,
      `Track reference "${key}" cannot set title without a numeric durationMs fallback`,
    );
  }

  return createSuccess({
    nativeTrackId: nativeTrackId.value,
    filePath: filePath.value,
    title: title.value,
    durationMs: durationMs.value,
  });
}

/**
 * Normalizes a track key for comparison (case, Unicode NFC, path separators)
 * so plugin (C++) and desktop (JS) key formats match across locales.
 */
export function normalizeTrackKeyForComparison(key: string): string {
  const n = (s: string) => s.normalize('NFC').toLowerCase();
  if (key.startsWith('path:')) {
    const pathPart = key.slice(5).replace(/\//g, '\\');
    return 'path:' + n(pathPart);
  }
  if (key.startsWith('native:')) {
    return 'native:' + n(key.slice(7));
  }
  if (key.startsWith('title-duration:')) {
    return 'title-duration:' + n(key.slice('title-duration:'.length));
  }
  return n(key);
}

function validateCanonicalTrackKeyEcho(
  reference: AimpTrackReferencePayload | null | undefined,
  explicitTrackKey: string | null | undefined,
  messagePrefix: string,
  referenceFieldName: 'activeTrack' | 'currentTrack',
  keyFieldName: 'activeTrackKey' | 'currentTrackKey',
): AimpValidationResult<null> {
  if (explicitTrackKey === undefined || explicitTrackKey === null) {
    return createSuccess(null);
  }

  if (!reference) {
    return createProtocolError(
      'invalidPayload',
      `${messagePrefix} ${keyFieldName} cannot be sent without ${referenceFieldName}`,
      explicitTrackKey,
    );
  }

  const derivedTrackKey = deriveAimpTrackKey(reference).trackKey;
  const normalizedDerived = normalizeTrackKeyForComparison(derivedTrackKey);
  const normalizedExplicit = normalizeTrackKeyForComparison(explicitTrackKey);
  if (normalizedDerived !== normalizedExplicit) {
    return createProtocolError(
      'invalidPayload',
      `${messagePrefix} ${referenceFieldName} and ${keyFieldName} must resolve to the same canonical track identity`,
      explicitTrackKey,
    );
  }

  return createSuccess(null);
}

function validatePlaylistActiveTrackMembership(
  tracks: AimpPlaylistTrackPayload[],
  activeTrack: AimpTrackReferencePayload | null | undefined,
  activeTrackKey: string | null | undefined,
): AimpValidationResult<null> {
  const flaggedActiveTracks = tracks.filter((track) => track.isActive === true);
  if (flaggedActiveTracks.length > 1) {
    return createProtocolError(
      'invalidPayload',
      'AIMP playlistSnapshot cannot mark more than one track active',
    );
  }

  const resolvedActiveTrackKey =
    resolveAimpTrackKeyFromReference(activeTrack) ?? activeTrackKey ?? null;
  if (resolvedActiveTrackKey === null) {
    return createSuccess(null);
  }

  const normalizedResolved = normalizeTrackKeyForComparison(resolvedActiveTrackKey);
  const matchingTracks = tracks.filter(
    (track) =>
      normalizeTrackKeyForComparison(deriveAimpTrackKey(track).trackKey) === normalizedResolved,
  );
  if (matchingTracks.length === 0) {
    return createProtocolError(
      'invalidPayload',
      'AIMP playlistSnapshot activeTrack must resolve to a member of tracks',
      resolvedActiveTrackKey,
    );
  }

  if (
    flaggedActiveTracks.length === 1 &&
    normalizeTrackKeyForComparison(deriveAimpTrackKey(flaggedActiveTracks[0]).trackKey) !==
      normalizedResolved
  ) {
    return createProtocolError(
      'invalidPayload',
      'AIMP playlistSnapshot active track membership must match activeTrack and track flags',
      resolvedActiveTrackKey,
    );
  }

  return createSuccess(null);
}

export function validateAimpProtocolMessage(
  value: unknown,
): AimpValidationResult<AimpProtocolMessage> {
  if (!isPlainObject(value)) {
    return createProtocolError('invalidEnvelope', 'AIMP protocol message must be an object');
  }

  const typeResult = readString(value, 'type', 'AIMP protocol message type is required');
  if (!typeResult.success) {
    return typeResult;
  }

  const protocolVersionResult = readString(
    value,
    'protocolVersion',
    'AIMP protocolVersion is required',
  );
  if (!protocolVersionResult.success) {
    return protocolVersionResult;
  }

  if (!isSupportedAimpProtocolVersion(protocolVersionResult.value)) {
    return {
      success: false,
      error: getAimpProtocolVersionError(protocolVersionResult.value),
    };
  }

  const sequenceResult = readInteger(value, 'sequence', 'AIMP sequence is required');
  if (!sequenceResult.success) {
    return sequenceResult;
  }

  const messageIdResult = readString(value, 'messageId', 'AIMP messageId is required');
  if (!messageIdResult.success) {
    return messageIdResult;
  }

  const sentAtResult = readString(value, 'sentAt', 'AIMP sentAt is required');
  if (!sentAtResult.success) {
    return sentAtResult;
  }

  if (!isValidIsoTimestamp(sentAtResult.value)) {
    return createProtocolError(
      'invalidPayload',
      'AIMP sentAt must be a valid ISO timestamp',
      sentAtResult.value,
    );
  }

  const payload = value.payload;
  if (!isPlainObject(payload)) {
    return createProtocolError('invalidPayload', 'AIMP payload must be an object');
  }

  const baseEnvelope: AimpEnvelopeMetadata = {
    protocolVersion: protocolVersionResult.value,
    sequence: sequenceResult.value,
    messageId: messageIdResult.value,
    sentAt: sentAtResult.value,
  };

  switch (typeResult.value) {
    case 'hello':
      return validateHelloMessage(baseEnvelope, payload);
    case 'playlistSnapshot':
      return validatePlaylistSnapshotMessage(baseEnvelope, payload);
    case 'playbackSnapshot':
      return validatePlaybackSnapshotMessage(baseEnvelope, payload);
    case 'heartbeat':
      return validateHeartbeatMessage(baseEnvelope, payload);
    case 'goodbye':
      return validateGoodbyeMessage(baseEnvelope, payload);
    default:
      return createProtocolError(
        'invalidType',
        `Unsupported AIMP message type "${typeResult.value}"`,
      );
  }
}

export function validateAimpServerProtocolMessage(
  value: unknown,
): AimpValidationResult<AimpProtocolServerMessage> {
  if (!isPlainObject(value)) {
    return createProtocolError('invalidEnvelope', 'AIMP server protocol message must be an object');
  }

  const typeResult = readString(value, 'type', 'AIMP server protocol message type is required');
  if (!typeResult.success) {
    return typeResult;
  }

  const protocolVersionResult = readString(
    value,
    'protocolVersion',
    'AIMP server protocolVersion is required',
  );
  if (!protocolVersionResult.success) {
    return protocolVersionResult;
  }

  if (!isSupportedAimpProtocolVersion(protocolVersionResult.value)) {
    return {
      success: false,
      error: getAimpProtocolVersionError(protocolVersionResult.value),
    };
  }

  const sequenceResult = readInteger(value, 'sequence', 'AIMP server sequence is required');
  if (!sequenceResult.success) {
    return sequenceResult;
  }

  const messageIdResult = readString(value, 'messageId', 'AIMP server messageId is required');
  if (!messageIdResult.success) {
    return messageIdResult;
  }

  const sentAtResult = readString(value, 'sentAt', 'AIMP server sentAt is required');
  if (!sentAtResult.success) {
    return sentAtResult;
  }

  if (!isValidIsoTimestamp(sentAtResult.value)) {
    return createProtocolError(
      'invalidPayload',
      'AIMP server sentAt must be a valid ISO timestamp',
      sentAtResult.value,
    );
  }

  const payload = value.payload;
  if (!isPlainObject(payload)) {
    return createProtocolError('invalidPayload', 'AIMP server payload must be an object');
  }

  const baseEnvelope: AimpEnvelopeMetadata = {
    protocolVersion: protocolVersionResult.value,
    sequence: sequenceResult.value,
    messageId: messageIdResult.value,
    sentAt: sentAtResult.value,
  };

  switch (typeResult.value) {
    case 'helloAck':
      return validateHelloAckMessage(baseEnvelope, payload);
    default:
      return createProtocolError(
        'invalidType',
        `Unsupported AIMP server message type "${typeResult.value}"`,
      );
  }
}

function validateHelloMessage(
  envelope: AimpEnvelopeMetadata,
  payload: Record<string, unknown>,
): AimpValidationResult<AimpHelloMessage> {
  const pluginName = readString(payload, 'pluginName', 'AIMP hello payload requires pluginName');
  if (!pluginName.success) {
    return pluginName;
  }

  const pluginVersion = readString(
    payload,
    'pluginVersion',
    'AIMP hello payload requires pluginVersion',
  );
  if (!pluginVersion.success) {
    return pluginVersion;
  }

  const aimpVersion = readString(payload, 'aimpVersion', 'AIMP hello payload requires aimpVersion');
  if (!aimpVersion.success) {
    return aimpVersion;
  }

  const architecture = readString(
    payload,
    'architecture',
    'AIMP hello payload requires architecture',
  );
  if (!architecture.success) {
    return architecture;
  }

  if (architecture.value !== 'x64') {
    return createProtocolError(
      'invalidPayload',
      'AIMP hello architecture must be "x64"',
      architecture.value,
    );
  }

  const platform = readString(payload, 'platform', 'AIMP hello payload requires platform');
  if (!platform.success) {
    return platform;
  }

  if (platform.value !== 'win32') {
    return createProtocolError(
      'invalidPayload',
      'AIMP hello platform must be "win32"',
      platform.value,
    );
  }

  const instanceId = readString(payload, 'instanceId', 'AIMP hello payload requires instanceId');
  if (!instanceId.success) {
    return instanceId;
  }

  return createSuccess({
    ...envelope,
    type: 'hello',
    payload: {
      pluginName: pluginName.value,
      pluginVersion: pluginVersion.value,
      aimpVersion: aimpVersion.value,
      architecture: 'x64',
      platform: 'win32',
      instanceId: instanceId.value,
    },
  });
}

function validateHelloAckMessage(
  envelope: AimpEnvelopeMetadata,
  payload: Record<string, unknown>,
): AimpValidationResult<AimpHelloAckMessage> {
  const accepted = readBoolean(payload, 'accepted', 'AIMP helloAck payload requires accepted');
  if (!accepted.success) {
    return accepted;
  }

  const serverProtocolVersion = readString(
    payload,
    'serverProtocolVersion',
    'AIMP helloAck payload requires serverProtocolVersion',
  );
  if (!serverProtocolVersion.success) {
    return serverProtocolVersion;
  }

  if (!isSupportedAimpProtocolVersion(serverProtocolVersion.value)) {
    return {
      success: false,
      error: getAimpProtocolVersionError(serverProtocolVersion.value),
    };
  }

  const errorCode = readValidatedOptionalString(
    payload,
    'errorCode',
    'AIMP helloAck payload errorCode must be a non-empty string when provided',
  );
  if (!errorCode.success) {
    return errorCode;
  }

  if (
    errorCode.value !== undefined &&
    !['unsupportedProtocolVersion', 'rejected'].includes(errorCode.value)
  ) {
    return createProtocolError(
      'invalidPayload',
      'AIMP helloAck payload errorCode is invalid',
      errorCode.value,
    );
  }

  const detail = readValidatedOptionalString(
    payload,
    'detail',
    'AIMP helloAck payload detail must be a non-empty string when provided',
  );
  if (!detail.success) {
    return detail;
  }

  if (accepted.value && errorCode.value === 'unsupportedProtocolVersion') {
    return createProtocolError(
      'invalidPayload',
      'AIMP helloAck cannot accept a session while reporting unsupportedProtocolVersion',
    );
  }

  if (accepted.value && errorCode.value !== undefined) {
    return createProtocolError(
      'invalidPayload',
      'AIMP helloAck cannot accept a session while reporting an errorCode',
      errorCode.value,
    );
  }

  if (!accepted.value && errorCode.value === undefined) {
    return createProtocolError(
      'invalidPayload',
      'AIMP helloAck rejection must include an errorCode',
    );
  }

  return createSuccess({
    ...envelope,
    type: 'helloAck',
    payload: {
      accepted: accepted.value,
      serverProtocolVersion: serverProtocolVersion.value,
      errorCode: errorCode.value as AimpHelloAckErrorCode | undefined,
      detail: detail.value,
    },
  });
}

function validatePlaylistSnapshotMessage(
  envelope: AimpEnvelopeMetadata,
  payload: Record<string, unknown>,
): AimpValidationResult<AimpPlaylistSnapshotMessage> {
  const playlistId = readString(
    payload,
    'playlistId',
    'AIMP playlistSnapshot payload requires playlistId',
  );
  if (!playlistId.success) {
    return playlistId;
  }

  const playlistName = readString(
    payload,
    'playlistName',
    'AIMP playlistSnapshot payload requires playlistName',
  );
  if (!playlistName.success) {
    return playlistName;
  }

  const revision = readInteger(payload, 'revision', 'AIMP playlistSnapshot requires revision');
  if (!revision.success) {
    return revision;
  }

  const activeTrack = validateTrackReferencePayload(
    payload,
    'activeTrack',
    'AIMP playlistSnapshot activeTrack is invalid',
  );
  if (!activeTrack.success) {
    return activeTrack;
  }

  const activeTrackKey = readValidatedOptionalNullableString(
    payload,
    'activeTrackKey',
    'AIMP playlistSnapshot activeTrackKey must be a string or null when provided',
  );
  if (!activeTrackKey.success) {
    return activeTrackKey;
  }

  const tracksValue = payload.tracks;
  if (!Array.isArray(tracksValue)) {
    return createProtocolError(
      'invalidPayload',
      'AIMP playlistSnapshot payload requires tracks array',
    );
  }

  const tracks: AimpPlaylistTrackPayload[] = [];
  for (const [index, trackValue] of tracksValue.entries()) {
    if (!isPlainObject(trackValue)) {
      return createProtocolError(
        'invalidPayload',
        'AIMP playlistSnapshot track must be an object',
        `Track index ${index}`,
      );
    }

    const title = readString(
      trackValue,
      'title',
      `AIMP playlistSnapshot track at index ${index} requires title`,
    );
    if (!title.success) {
      return title;
    }

    const positionInQueue = readInteger(
      trackValue,
      'positionInQueue',
      `AIMP playlistSnapshot track at index ${index} requires positionInQueue`,
    );
    if (!positionInQueue.success) {
      return positionInQueue;
    }

    const durationMs = readValidatedOptionalInteger(
      trackValue,
      'durationMs',
      `AIMP playlistSnapshot track at index ${index} has invalid durationMs`,
    );
    if (!durationMs.success) {
      return durationMs;
    }

    const nativeTrackId = readValidatedOptionalString(
      trackValue,
      'nativeTrackId',
      `AIMP playlistSnapshot track at index ${index} has invalid nativeTrackId`,
    );
    if (!nativeTrackId.success) {
      return nativeTrackId;
    }

    const filePath = readValidatedOptionalString(
      trackValue,
      'filePath',
      `AIMP playlistSnapshot track at index ${index} has invalid filePath`,
    );
    if (!filePath.success) {
      return filePath;
    }

    const artist = readValidatedOptionalStringAllowEmpty(
      trackValue,
      'artist',
      `AIMP playlistSnapshot track at index ${index} has invalid artist`,
    );
    if (!artist.success) {
      return artist;
    }

    const album = readValidatedOptionalStringAllowEmpty(
      trackValue,
      'album',
      `AIMP playlistSnapshot track at index ${index} has invalid album`,
    );
    if (!album.success) {
      return album;
    }

    const isActive = readValidatedOptionalBoolean(
      trackValue,
      'isActive',
      `AIMP playlistSnapshot track at index ${index} has invalid isActive`,
    );
    if (!isActive.success) {
      return isActive;
    }

    const trackKey = readValidatedOptionalString(
      trackValue,
      'trackKey',
      `AIMP playlistSnapshot track at index ${index} has invalid trackKey`,
    );
    if (!trackKey.success) {
      return trackKey;
    }

    if (!nativeTrackId.value && !filePath.value && durationMs.value === undefined) {
      return createProtocolError(
        'invalidPayload',
        'AIMP track identity requires nativeTrackId, filePath, or durationMs for title+duration fallback',
        `Track index ${index}`,
      );
    }

    tracks.push({
      trackKey: trackKey.value,
      nativeTrackId: nativeTrackId.value,
      filePath: filePath.value,
      title: title.value,
      artist: artist.value,
      album: album.value,
      durationMs: durationMs.value,
      positionInQueue: positionInQueue.value,
      isActive: isActive.value,
    });
  }

  const activeTrackKeyValidation = validateCanonicalTrackKeyEcho(
    activeTrack.value,
    activeTrackKey.value,
    'AIMP playlistSnapshot',
    'activeTrack',
    'activeTrackKey',
  );
  if (!activeTrackKeyValidation.success) {
    return activeTrackKeyValidation;
  }

  const activeTrackMembershipValidation = validatePlaylistActiveTrackMembership(
    tracks,
    activeTrack.value,
    activeTrackKey.value,
  );
  if (!activeTrackMembershipValidation.success) {
    return activeTrackMembershipValidation;
  }

  return createSuccess({
    ...envelope,
    type: 'playlistSnapshot',
    payload: {
      playlistId: playlistId.value,
      playlistName: playlistName.value,
      revision: revision.value,
      activeTrack: activeTrack.value ?? null,
      activeTrackKey: activeTrackKey.value ?? null,
      tracks,
    },
  });
}

function validatePlaybackSnapshotMessage(
  envelope: AimpEnvelopeMetadata,
  payload: Record<string, unknown>,
): AimpValidationResult<AimpPlaybackSnapshotMessage> {
  const revision = readInteger(payload, 'revision', 'AIMP playbackSnapshot requires revision');
  if (!revision.success) {
    return revision;
  }

  const status = readString(payload, 'status', 'AIMP playbackSnapshot requires status');
  if (!status.success) {
    return status;
  }

  if (!['playing', 'paused', 'stopped'].includes(status.value)) {
    return createProtocolError(
      'invalidPayload',
      'AIMP playbackSnapshot status must be one of playing, paused, stopped',
      status.value,
    );
  }

  const positionMs = readInteger(
    payload,
    'positionMs',
    'AIMP playbackSnapshot requires positionMs',
  );
  if (!positionMs.success) {
    return positionMs;
  }

  const currentTrack = validateTrackReferencePayload(
    payload,
    'currentTrack',
    'AIMP playbackSnapshot currentTrack is invalid',
  );
  if (!currentTrack.success) {
    return currentTrack;
  }

  const durationMs = readValidatedOptionalNullableInteger(
    payload,
    'durationMs',
    'AIMP playbackSnapshot durationMs must be a non-negative integer or null when provided',
  );
  if (!durationMs.success) {
    return durationMs;
  }

  const currentTrackKey = readValidatedOptionalNullableString(
    payload,
    'currentTrackKey',
    'AIMP playbackSnapshot currentTrackKey must be a string or null when provided',
  );
  if (!currentTrackKey.success) {
    return currentTrackKey;
  }

  const volumePercent = readValidatedOptionalInteger(
    payload,
    'volumePercent',
    'AIMP playbackSnapshot volumePercent must be a non-negative integer when provided',
  );
  if (!volumePercent.success) {
    return volumePercent;
  }

  if (volumePercent.value !== undefined && volumePercent.value > 100) {
    return createProtocolError(
      'invalidPayload',
      'AIMP playbackSnapshot volumePercent must be between 0 and 100',
    );
  }

  const currentTrackKeyValidation = validateCanonicalTrackKeyEcho(
    currentTrack.value,
    currentTrackKey.value,
    'AIMP playbackSnapshot',
    'currentTrack',
    'currentTrackKey',
  );
  if (!currentTrackKeyValidation.success) {
    return currentTrackKeyValidation;
  }

  const isMuted = readValidatedOptionalBoolean(
    payload,
    'isMuted',
    'AIMP playbackSnapshot isMuted must be a boolean when provided',
  );
  if (!isMuted.success) {
    return isMuted;
  }

  return createSuccess({
    ...envelope,
    type: 'playbackSnapshot',
    payload: {
      revision: revision.value,
      status: status.value as AimpPlaybackStatus,
      currentTrack: currentTrack.value ?? null,
      currentTrackKey: currentTrackKey.value ?? null,
      positionMs: positionMs.value,
      durationMs: durationMs.value ?? null,
      volumePercent: volumePercent.value,
      isMuted: isMuted.value,
    },
  });
}

function validateHeartbeatMessage(
  envelope: AimpEnvelopeMetadata,
  payload: Record<string, unknown>,
): AimpValidationResult<AimpHeartbeatMessage> {
  const connectionUptimeMs = readInteger(
    payload,
    'connectionUptimeMs',
    'AIMP heartbeat requires connectionUptimeMs',
  );
  if (!connectionUptimeMs.success) {
    return connectionUptimeMs;
  }

  const lastPlaylistRevision = readValidatedOptionalInteger(
    payload,
    'lastPlaylistRevision',
    'AIMP heartbeat lastPlaylistRevision must be a non-negative integer when provided',
  );
  if (!lastPlaylistRevision.success) {
    return lastPlaylistRevision;
  }

  const lastPlaybackRevision = readValidatedOptionalInteger(
    payload,
    'lastPlaybackRevision',
    'AIMP heartbeat lastPlaybackRevision must be a non-negative integer when provided',
  );
  if (!lastPlaybackRevision.success) {
    return lastPlaybackRevision;
  }

  return createSuccess({
    ...envelope,
    type: 'heartbeat',
    payload: {
      connectionUptimeMs: connectionUptimeMs.value,
      lastPlaylistRevision: lastPlaylistRevision.value,
      lastPlaybackRevision: lastPlaybackRevision.value,
    },
  });
}

function validateGoodbyeMessage(
  envelope: AimpEnvelopeMetadata,
  payload: Record<string, unknown>,
): AimpValidationResult<AimpGoodbyeMessage> {
  const reason = readString(payload, 'reason', 'AIMP goodbye requires reason');
  if (!reason.success) {
    return reason;
  }

  if (
    ![
      'pluginShutdown',
      'appClosing',
      'sourceDisabled',
      'protocolMismatch',
      'restart',
      'unknown',
    ].includes(reason.value)
  ) {
    return createProtocolError(
      'invalidPayload',
      'AIMP goodbye reason is not supported',
      reason.value,
    );
  }

  const detail = readValidatedOptionalString(
    payload,
    'detail',
    'AIMP goodbye detail must be a non-empty string when provided',
  );
  if (!detail.success) {
    return detail;
  }

  return createSuccess({
    ...envelope,
    type: 'goodbye',
    payload: {
      reason: reason.value as AimpGoodbyePayload['reason'],
      detail: detail.value,
    },
  });
}

export function deriveAimpTrackKey(track: AimpTrackReferencePayload | AimpPlaylistTrackPayload): {
  trackKey: string;
  identityStrategy: AimpTrackIdentityStrategy;
} {
  if (track.nativeTrackId) {
    return {
      trackKey: `native:${track.nativeTrackId}`,
      identityStrategy: 'nativeTrackId',
    };
  }

  if (track.filePath) {
    return {
      trackKey: `path:${track.filePath.toLowerCase()}`,
      identityStrategy: 'filePath',
    };
  }

  if (!track.title) {
    throw new Error(
      'AIMP track identity requires title when nativeTrackId and filePath are missing.',
    );
  }

  return {
    trackKey: `title-duration:${track.title.toLowerCase()}::${track.durationMs ?? 0}`,
    identityStrategy: 'titleDuration',
  };
}

export function resolveAimpTrackKeyReference(
  reference: AimpTrackReferencePayload | null | undefined,
  legacyTrackKey?: string | null,
): string | null {
  if (reference) {
    return deriveAimpTrackKey(reference).trackKey;
  }

  return legacyTrackKey ?? null;
}

export function resolveAimpTrackKeyFromReference(
  reference: AimpTrackReferencePayload | null | undefined,
): string | null {
  if (!reference) {
    return null;
  }

  return deriveAimpTrackKey(reference).trackKey;
}

export function normalizeAimpPluginMetadata(
  message: AimpHelloMessage,
  connectedAt: string,
): AimpPluginMetadataDto {
  return {
    pluginName: message.payload.pluginName,
    pluginVersion: message.payload.pluginVersion,
    aimpVersion: message.payload.aimpVersion,
    protocolVersion: message.protocolVersion,
    architecture: message.payload.architecture,
    platform: message.payload.platform,
    instanceId: message.payload.instanceId,
    connectedAt,
    lastHelloAt: message.sentAt,
  };
}

export function normalizeAimpPlaylistSnapshot(
  message: AimpPlaylistSnapshotMessage,
  receivedAt: string,
): AimpPlaylistSnapshotDto {
  const payloadActiveKey =
    typeof message.payload.activeTrackKey === 'string' &&
    message.payload.activeTrackKey.trim().length > 0
      ? message.payload.activeTrackKey.trim()
      : null;
  const explicitActiveTrackKey =
    payloadActiveKey ?? resolveAimpTrackKeyFromReference(message.payload.activeTrack);
  const tracks = message.payload.tracks
    .slice()
    .sort((left, right) => left.positionInQueue - right.positionInQueue)
    .map((track) => {
      const identity = deriveAimpTrackKey(track);
      const trackKey =
        typeof track.trackKey === 'string' && track.trackKey.trim().length > 0
          ? track.trackKey.trim()
          : identity.trackKey;
      return {
        trackKey,
        identityStrategy: identity.identityStrategy,
        nativeTrackId: track.nativeTrackId,
        filePath: track.filePath,
        title: track.title,
        artist: track.artist,
        album: track.album,
        durationMs: track.durationMs,
        order: track.positionInQueue,
        isActive: track.isActive ?? trackKey === explicitActiveTrackKey,
      };
    });

  const activeTrackKey =
    (explicitActiveTrackKey !== null &&
    tracks.some((track) => track.trackKey === explicitActiveTrackKey)
      ? explicitActiveTrackKey
      : null) ??
    tracks.find((track) => track.isActive)?.trackKey ??
    null;

  // Only one track may be active; with duplicate trackKeys, mark only the first match
  let activeMarked = false;
  return {
    playlistId: message.payload.playlistId,
    playlistName: message.payload.playlistName,
    revision: message.payload.revision,
    trackCount: tracks.length,
    activeTrackKey,
    receivedAt,
    sentAt: message.sentAt,
    tracks: tracks.map((track) => {
      const matchesActive = activeTrackKey !== null && track.trackKey === activeTrackKey;
      const isActive = matchesActive && !activeMarked;
      if (matchesActive) activeMarked = true;
      return { ...track, isActive };
    }),
  };
}

export function normalizeAimpPlaybackSnapshot(
  message: AimpPlaybackSnapshotMessage,
  receivedAt: string,
): AimpPlaybackSnapshotDto {
  return {
    revision: message.payload.revision,
    status: message.payload.status,
    currentTrackKey: resolveAimpTrackKeyFromReference(message.payload.currentTrack),
    positionMs: message.payload.positionMs,
    durationMs: message.payload.durationMs ?? undefined,
    volumePercent: message.payload.volumePercent,
    isMuted: message.payload.isMuted ?? false,
    receivedAt,
    sentAt: message.sentAt,
  };
}

export function createAimpCompatibilityCheckpointInput(
  state: Pick<
    AimpBridgeState,
    | 'connection'
    | 'liveStreamStarted'
    | 'playlistSnapshot'
    | 'playbackSnapshot'
    | 'pluginMetadata'
    | 'sourceSelection'
  >,
): AimpCompatibilityCheckpointInput {
  return {
    source: 'AIMP',
    protocolVersion: AIMP_PROTOCOL_VERSION,
    plugin: state.pluginMetadata
      ? {
          pluginName: state.pluginMetadata.pluginName,
          pluginVersion: state.pluginMetadata.pluginVersion,
          aimpVersion: state.pluginMetadata.aimpVersion,
          instanceId: state.pluginMetadata.instanceId,
          connectedAt: state.pluginMetadata.connectedAt,
        }
      : null,
    connectionPhase: state.connection.phase,
    liveStreamStarted: state.liveStreamStarted,
    playlist: state.playlistSnapshot
      ? {
          playlistId: state.playlistSnapshot.playlistId,
          playlistName: state.playlistSnapshot.playlistName,
          revision: state.playlistSnapshot.revision,
          trackCount: state.playlistSnapshot.trackCount,
          activeTrackKey: state.playlistSnapshot.activeTrackKey,
          tracks: state.playlistSnapshot.tracks,
        }
      : null,
    playback: state.playbackSnapshot
      ? {
          revision: state.playbackSnapshot.revision,
          status: state.playbackSnapshot.status,
          currentTrackKey: state.playbackSnapshot.currentTrackKey,
          positionMs: state.playbackSnapshot.positionMs,
          durationMs: state.playbackSnapshot.durationMs,
        }
      : null,
  };
}

export function createInitialAimpBridgeState(): AimpBridgeState {
  const environment: AimpEnvironmentEligibility = {
    eligible: false,
    pipeName: AIMP_PROTOCOL_PIPE_NAME,
    platform: 'unknown',
    architecture: 'unknown',
    gatingReasons: [
      {
        code: 'sourceNotAimp',
        message: 'AIMP named-pipe server stays disabled until source selection changes to AIMP.',
      },
    ],
  };

  const baseState: AimpBridgeState = {
    protocolVersion: AIMP_PROTOCOL_VERSION,
    pipeName: AIMP_PROTOCOL_PIPE_NAME,
    sourceSelection: 'cherryPlayPlayer',
    liveStreamStarted: false,
    environment,
    connection: {
      phase: 'disconnected',
      appListening: false,
      pluginConnected: false,
      staleAfterMs: AIMP_HEARTBEAT_STALE_TIMEOUT_MS,
      lastMessageAt: null,
      lastHeartbeatAt: null,
      disconnectReason: null,
      protocolError: null,
    },
    pluginMetadata: null,
    playlistSnapshot: null,
    playbackSnapshot: null,
    compatibilityCheckpointInput: {
      source: 'AIMP',
      protocolVersion: AIMP_PROTOCOL_VERSION,
      plugin: null,
      connectionPhase: 'disconnected',
      liveStreamStarted: false,
      playlist: null,
      playback: null,
    },
  };

  baseState.compatibilityCheckpointInput = createAimpCompatibilityCheckpointInput(baseState);
  return baseState;
}

export function isAimpSourceSelection(value: unknown): value is AimpSourceSelection {
  return value === 'aimp' || value === 'cherryPlayPlayer';
}

export function validateAimpSourceSelectionPayload(
  value: unknown,
): AimpValidationResult<{ sourceSelection: AimpSourceSelection }> {
  if (!isPlainObject(value)) {
    return createProtocolError('invalidPayload', 'AIMP source selection payload must be an object');
  }

  if (!isAimpSourceSelection(value.sourceSelection)) {
    return createProtocolError(
      'invalidPayload',
      'AIMP source selection must be "cherryPlayPlayer" or "aimp"',
    );
  }

  return createSuccess({
    sourceSelection: value.sourceSelection,
  });
}

export function validateAimpLiveStreamPayload(
  value: unknown,
): AimpValidationResult<{ liveStreamStarted: boolean }> {
  if (!isPlainObject(value)) {
    return createProtocolError('invalidPayload', 'AIMP live stream payload must be an object');
  }

  if (typeof value.liveStreamStarted !== 'boolean') {
    return createProtocolError(
      'invalidPayload',
      'AIMP live stream payload must include boolean liveStreamStarted',
    );
  }

  return createSuccess({
    liveStreamStarted: value.liveStreamStarted,
  });
}

export function validateAimpBridgeState(value: unknown): AimpValidationResult<AimpBridgeState> {
  if (!isPlainObject(value)) {
    return createProtocolError('invalidPayload', 'AIMP bridge state must be an object');
  }

  const protocolVersion = readString(
    value,
    'protocolVersion',
    'AIMP bridge state protocolVersion is required',
  );
  if (!protocolVersion.success) {
    return protocolVersion;
  }

  if (!isSupportedAimpProtocolVersion(protocolVersion.value)) {
    return {
      success: false,
      error: getAimpProtocolVersionError(protocolVersion.value),
    };
  }

  const pipeName = readString(value, 'pipeName', 'AIMP bridge state pipeName is required');
  if (!pipeName.success) {
    return pipeName;
  }

  if (!isAimpSourceSelection(value.sourceSelection)) {
    return createProtocolError(
      'invalidPayload',
      'AIMP bridge state sourceSelection must be "cherryPlayPlayer" or "aimp"',
    );
  }

  const liveStreamStarted = readBoolean(
    value,
    'liveStreamStarted',
    'AIMP bridge state liveStreamStarted is required',
  );
  if (!liveStreamStarted.success) {
    return liveStreamStarted;
  }

  const environment = validateAimpEnvironmentEligibility(value.environment);
  if (!environment.success) {
    return environment;
  }

  if (environment.value.pipeName !== pipeName.value) {
    return createProtocolError(
      'invalidPayload',
      'AIMP environment pipeName must match bridge state pipeName',
    );
  }

  const connection = validateAimpConnectionState(value.connection);
  if (!connection.success) {
    return connection;
  }

  const pluginMetadata = validateAimpPluginMetadataState(
    'pluginMetadata' in value ? value.pluginMetadata : null,
  );
  if (!pluginMetadata.success) {
    return pluginMetadata;
  }

  const playlistSnapshot = validateAimpPlaylistSnapshotState(
    'playlistSnapshot' in value ? value.playlistSnapshot : null,
  );
  if (!playlistSnapshot.success) {
    return playlistSnapshot;
  }

  const playbackSnapshot = validateAimpPlaybackSnapshotState(
    'playbackSnapshot' in value ? value.playbackSnapshot : null,
  );
  if (!playbackSnapshot.success) {
    return playbackSnapshot;
  }

  const snapshotConsistencyError = getAimpPlaybackPlaylistConsistencyError(
    playlistSnapshot.value,
    playbackSnapshot.value,
  );
  if (snapshotConsistencyError) {
    return createProtocolError(
      'invalidPayload',
      snapshotConsistencyError,
      playbackSnapshot.value?.currentTrackKey ?? undefined,
    );
  }

  const compatibilityCheckpointInput = validateAimpCompatibilityCheckpointInputState(
    value.compatibilityCheckpointInput,
  );
  if (!compatibilityCheckpointInput.success) {
    return compatibilityCheckpointInput;
  }

  if (connection.value.pluginConnected && pluginMetadata.value === null) {
    return createProtocolError(
      'invalidPayload',
      'AIMP bridge state requires pluginMetadata while pluginConnected=true',
    );
  }

  if (liveStreamStarted.value && value.sourceSelection !== 'aimp') {
    return createProtocolError(
      'invalidPayload',
      'AIMP bridge state cannot set liveStreamStarted=true when sourceSelection is not "aimp"',
    );
  }

  if (liveStreamStarted.value && !environment.value.eligible) {
    return createProtocolError(
      'invalidPayload',
      'AIMP bridge state cannot set liveStreamStarted=true while environment is ineligible',
    );
  }

  if (
    liveStreamStarted.value &&
    (connection.value.phase !== 'connected' ||
      !connection.value.pluginConnected ||
      pluginMetadata.value === null)
  ) {
    return createProtocolError(
      'invalidPayload',
      'AIMP bridge state cannot set liveStreamStarted=true without an active plugin session',
    );
  }

  if (
    liveStreamStarted.value &&
    !hasUsableAimpLiveStreamSnapshots(playlistSnapshot.value, playbackSnapshot.value)
  ) {
    return createProtocolError(
      'invalidPayload',
      'AIMP bridge state cannot set liveStreamStarted=true without usable playlistSnapshot and playbackSnapshot DTOs',
    );
  }

  if (compatibilityCheckpointInput.value.protocolVersion !== protocolVersion.value) {
    return createProtocolError(
      'invalidPayload',
      'AIMP compatibilityCheckpointInput protocolVersion must match bridge state protocolVersion',
    );
  }

  if (compatibilityCheckpointInput.value.connectionPhase !== connection.value.phase) {
    return createProtocolError(
      'invalidPayload',
      'AIMP compatibilityCheckpointInput connectionPhase must match bridge state connection.phase',
    );
  }

  if (compatibilityCheckpointInput.value.liveStreamStarted !== liveStreamStarted.value) {
    return createProtocolError(
      'invalidPayload',
      'AIMP compatibilityCheckpointInput liveStreamStarted must match bridge state liveStreamStarted',
    );
  }

  const expectedCompatibilityInput = createAimpCompatibilityCheckpointInput({
    sourceSelection: value.sourceSelection,
    connection: connection.value,
    liveStreamStarted: liveStreamStarted.value,
    playlistSnapshot: playlistSnapshot.value,
    playbackSnapshot: playbackSnapshot.value,
    pluginMetadata: pluginMetadata.value,
  });

  if (!areJsonEqual(compatibilityCheckpointInput.value, expectedCompatibilityInput)) {
    return createProtocolError(
      'invalidPayload',
      'AIMP compatibilityCheckpointInput must mirror the normalized bridge state',
    );
  }

  return createSuccess({
    protocolVersion: protocolVersion.value,
    pipeName: pipeName.value,
    sourceSelection: value.sourceSelection,
    liveStreamStarted: liveStreamStarted.value,
    environment: environment.value,
    connection: connection.value,
    pluginMetadata: pluginMetadata.value,
    playlistSnapshot: playlistSnapshot.value,
    playbackSnapshot: playbackSnapshot.value,
    compatibilityCheckpointInput: compatibilityCheckpointInput.value,
  });
}

export function validateAimpBridgeStateResponse(value: unknown): AimpValidationResult<{
  success: boolean;
  data?: AimpBridgeState;
  error?: string;
}> {
  if (!isPlainObject(value)) {
    return createProtocolError('invalidPayload', 'AIMP IPC response must be an object');
  }

  const success = readBoolean(value, 'success', 'AIMP IPC response success flag is required');
  if (!success.success) {
    return success;
  }

  if (success.value) {
    if (!('data' in value)) {
      return createProtocolError('invalidPayload', 'AIMP IPC success response must include data');
    }

    const stateResult = validateAimpBridgeState(value.data);
    if (!stateResult.success) {
      return stateResult;
    }

    return createSuccess({
      success: true,
      data: stateResult.value,
    });
  }

  const error = readString(value, 'error', 'AIMP IPC failure response must include error');
  if (!error.success) {
    return error;
  }

  return createSuccess({
    success: false,
    error: error.value,
  });
}
