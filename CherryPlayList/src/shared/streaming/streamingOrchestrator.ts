import * as signalR from '@microsoft/signalr';

import { isDefinitivePartyExistenceError } from '../services/partyExistenceErrors';
import { partyService } from '../services/partyService';
import { signalRService } from '../services/signalRService';
import { logger } from '../utils/logger';

import { AimpBroadcastSource } from './AimpBroadcastSource';
import { isStreamingHubAllowed } from './onlineNetworkPolicy';
import type { StreamingNetworkPolicySettings } from './onlineNetworkPolicy';
import { subscribeAimpPartyPlaylistSync, subscribePartyPlaylistSync } from './partyPlaylistSync';
import type { PlaybackBroadcastSource, PlaylistForApiPayload } from './PlaybackBroadcastSource';

export interface StreamingOrchestratorConfig {
  partyId: string;
  broadcastSource: PlaybackBroadcastSource;
  streamingSource: 'cherryPlayPlayer' | 'aimp';
  networkSettings: Pick<StreamingNetworkPolicySettings, 'enableStreaming'>;
  onConnectionStateChange?: (state: signalR.HubConnectionState | null) => void;
  onPartyNotFound?: () => void;
  onConnectError?: (error: unknown) => void;
  onPublishError?: (operation: 'playlistPublish' | 'fullStatePublish', error: unknown) => void;
  onPublishSuccess?: () => void;
  onPlaylistSynced?: (payload: PlaylistForApiPayload) => void;
  onReconnectionFailed?: () => void;
  onPhaseChange?: (phase: StreamingRecoveryPhase) => void;
}

export type StreamingRecoveryPhase =
  | 'waitingForAuth'
  | 'connecting'
  | 'joining'
  | 'syncing'
  | 'ready'
  | 'retrying'
  | 'blocked';

const RECONNECT_DELAY_MS = 10_000;
const POSITION_TICK_MS = 1_000;
const FULL_STATE_COALESCE_MS = 50;
const NETWORK_STEP_TIMEOUT_MS = 8_000;
const RECONNECT_BACKOFF_MS = [
  RECONNECT_DELAY_MS,
  RECONNECT_DELAY_MS * 2,
  RECONNECT_DELAY_MS * 4,
  60_000,
];

export class StreamingOrchestrator {
  private config: StreamingOrchestratorConfig | null = null;
  private running = false;
  private connectInFlight: Promise<void> | null = null;
  private connectGeneration = 0;
  private sourceUnsubscribe: (() => void) | null = null;
  private playlistUnsubscribe: (() => void) | null = null;
  private positionInterval: NodeJS.Timeout | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private fullStateCoalesceTimer: NodeJS.Timeout | null = null;
  private liveSessionActive = false;
  private sessionStartInFlight: { partyId: string; promise: Promise<void>; attempt: number } | null =
    null;
  private sessionStartAttemptSequence = 0;
  private activeSessionStartAttemptByParty = new Map<string, number>();
  private sessionStartAttemptsHandledByTeardown = new Set<number>();
  private frozenStatePublishKey: string | null = null;
  private lifecycleTail: Promise<void> = Promise.resolve();
  private sourceRevision = 0;
  private ready = false;
  private reconnectAttempt = 0;

  private isCurrent(config: StreamingOrchestratorConfig, generation: number): boolean {
    return (
      generation === this.connectGeneration &&
      this.running &&
      this.config?.partyId === config.partyId &&
      this.config.broadcastSource === config.broadcastSource &&
      this.config.broadcastSource.sourceId === config.broadcastSource.sourceId &&
      this.config.streamingSource === config.streamingSource
    );
  }

  private setPhase(config: StreamingOrchestratorConfig, phase: StreamingRecoveryPhase): void {
    config.onPhaseChange?.(phase);
  }

  private withTimeout<T>(promise: Promise<T>, step: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error(`${step} timed out`)),
        NETWORK_STEP_TIMEOUT_MS,
      );
      promise.then(
        (value) => {
          clearTimeout(timeout);
          resolve(value);
        },
        (error: unknown) => {
          clearTimeout(timeout);
          reject(
            error instanceof Error
              ? error
              : new Error(typeof error === 'string' ? error : `${step} failed`),
          );
        },
      );
    });
  }

  private startSession(partyId: string): Promise<void> {
    const current = this.sessionStartInFlight;
    if (current?.partyId === partyId) return current.promise;
    const generation = this.connectGeneration;
    const attempt = ++this.sessionStartAttemptSequence;
    const startRequest = signalRService.startSession(partyId);
    let timedOut = false;
    const promise = this.withTimeout(startRequest, 'Session start').catch((error: unknown) => {
      if (error instanceof Error && error.message === 'Session start timed out') {
        timedOut = true;
      }
      throw error;
    });
    const pending = { partyId, promise, attempt };
    this.sessionStartInFlight = pending;
    void startRequest.then(
      () => {
        if (this.sessionStartAttemptsHandledByTeardown.has(attempt)) {
          this.sessionStartAttemptsHandledByTeardown.delete(attempt);
          return;
        }
        if (!timedOut) {
          this.activeSessionStartAttemptByParty.set(partyId, attempt);
          const isStillRequested =
            this.running &&
            this.config?.partyId === partyId &&
            this.config.broadcastSource.isLiveSessionActive();
          if (!isStillRequested && this.sessionStartInFlight !== pending) {
            void signalRService.endSession(partyId).then(
              () => this.clearSessionStartOwner(partyId, attempt),
              (error: unknown) => {
                logger.error('[StreamingOrchestrator] Failed to end stale session start', error);
              },
            );
          }
          return;
        }
        if ((this.activeSessionStartAttemptByParty.get(partyId) ?? 0) > attempt) return;
        const newerAttempt = this.sessionStartInFlight;
        if (newerAttempt?.partyId === partyId && newerAttempt.attempt > attempt) {
          void newerAttempt.promise.then(
            () => undefined,
            () => this.endLateTimedOutSession(partyId, generation, attempt),
          );
          return;
        }
        this.endLateTimedOutSession(partyId, generation, attempt);
      },
      () => undefined,
    );
    void promise.then(
      () => {
        if (this.sessionStartInFlight === pending) this.sessionStartInFlight = null;
      },
      () => {
        if (this.sessionStartInFlight === pending) this.sessionStartInFlight = null;
      },
    );
    return promise;
  }

  private endLateTimedOutSession(partyId: string, generation: number, attempt: number): void {
    if ((this.activeSessionStartAttemptByParty.get(partyId) ?? 0) > attempt) return;
    void signalRService.endSession(partyId).then(
          () => {
            if (generation === this.connectGeneration && this.running) {
              this.scheduleReconnect(generation);
            }
          },
          (error: unknown) => {
            logger.error('[StreamingOrchestrator] Failed to end late session start', error);
          },
        );
  }

  private clearSessionStartOwner(partyId: string, expectedAttempt: number | undefined): void {
    if (
      expectedAttempt !== undefined &&
      this.activeSessionStartAttemptByParty.get(partyId) === expectedAttempt
    ) {
      this.activeSessionStartAttemptByParty.delete(partyId);
    }
  }

  start(config: StreamingOrchestratorConfig): void {
    if (!isStreamingHubAllowed(config.networkSettings)) {
      void this.teardown();
      return;
    }
    const previous = this.config;
    const sameConfig =
      this.running &&
      previous?.partyId === config.partyId &&
      previous.broadcastSource === config.broadcastSource &&
      previous.broadcastSource.sourceId === config.broadcastSource.sourceId &&
      previous.streamingSource === config.streamingSource;
    if (sameConfig) {
      this.config = config;
      return;
    }
    this.stopInternal(false);
    this.config = config;
    this.running = true;
    signalRService.setPartyReconnectHandler((partyId) => this.restoreAfterReconnect(partyId));
    signalRService.onReconnectionFailed(() => this.handleHubReconnectionExhausted());
    void this.connectAndSubscribe();
  }

  stop(): void {
    void this.teardown();
  }

  async teardown(): Promise<void> {
    const partyId = this.config?.partyId;
    const source = this.config?.broadcastSource;
    const hadLiveSession = this.liveSessionActive || source?.isLiveSessionActive() === true;
    const sessionOwnerAttempt = partyId
      ? this.activeSessionStartAttemptByParty.get(partyId)
      : undefined;
    const pendingSessionStart =
      partyId && this.sessionStartInFlight?.partyId === partyId
        ? this.sessionStartInFlight.promise
        : null;
    const pendingSessionStartAttempt =
      partyId && this.sessionStartInFlight?.partyId === partyId
        ? this.sessionStartInFlight.attempt
        : null;
    this.stopInternal(true);
    const generation = this.connectGeneration;
    this.config = null;
    return this.enqueueLifecycle(async () => {
      if (generation !== this.connectGeneration) return;
      const pendingSessionStarted = pendingSessionStart
        ? await pendingSessionStart.then(
            () => true,
            () => false,
          )
        : false;
      if (generation !== this.connectGeneration) return;
      if (partyId && (hadLiveSession || pendingSessionStarted)) {
        await signalRService.endSession(partyId);
        this.clearSessionStartOwner(partyId, sessionOwnerAttempt);
        if (pendingSessionStartAttempt !== null) {
          this.sessionStartAttemptsHandledByTeardown.add(pendingSessionStartAttempt);
        }
        if (generation !== this.connectGeneration) return;
      }
      if (partyId && signalRService.isServiceConnected()) {
        await signalRService.resetPlaybackState(partyId);
        if (generation !== this.connectGeneration) return;
      }
      if (generation === this.connectGeneration) await signalRService.disconnect();
    });
  }

  async switchSource(config: StreamingOrchestratorConfig): Promise<void> {
    this.start(config);
    await this.connectInFlight;
  }

  private enqueueLifecycle<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.lifecycleTail.then(operation, operation);
    this.lifecycleTail = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  reconnect(supersede = true): void {
    void this.recover(supersede);
  }

  private recover(supersede: boolean): Promise<void> | void {
    if (!this.config || !this.running) {
      return;
    }
    if (this.connectInFlight && !supersede) {
      return this.connectInFlight;
    }
    this.connectGeneration += 1;
    if (supersede) this.connectInFlight = null;
    this.ready = false;
    this.reconnectAttempt = 0;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    return this.connectAndSubscribe();
  }

  syncAimpFrozenState(enableStreaming: boolean): void {
    const config = this.config;
    const partyId = config?.partyId;

    if (!partyId || !this.running || !this.ready || config.streamingSource !== 'aimp') {
      this.frozenStatePublishKey = null;
      return;
    }

    const source = config.broadcastSource;
    if (!(source instanceof AimpBroadcastSource)) {
      this.frozenStatePublishKey = null;
      return;
    }

    const snapshot = source.getFrozenStateSnapshot(enableStreaming);
    if (!snapshot) {
      this.frozenStatePublishKey = null;
      return;
    }

    if (this.frozenStatePublishKey === snapshot.key) {
      return;
    }

    this.frozenStatePublishKey = snapshot.key;
    const generation = this.connectGeneration;

    if (!signalRService.isServiceConnected()) {
      return;
    }

    void this.withTimeout(signalRService.notifyStateChangedOrThrow(partyId), 'State notification')
      .then(() => {
        if (!this.isCurrent(config, generation)) return;
        return this.withTimeout(
          signalRService.updateFullStateOrThrow(partyId, snapshot.dto),
          'Full-state publish',
        );
      })
      .then(() => {
        if (!this.isCurrent(config, generation)) return;
        config.onPublishSuccess?.();
      })
      .catch((error) => {
        if (!this.isCurrent(config, generation)) return;
        logger.error('[StreamingOrchestrator] Failed to publish frozen AIMP state', error);
        config.onPublishError?.('fullStatePublish', error);
      });
  }

  syncLiveSession(isLive: boolean): void {
    const config = this.config;
    const partyId = config?.partyId;
    const generation = this.connectGeneration;
    if (!partyId || !this.running || !this.ready || !signalRService.isServiceConnected()) {
      return;
    }

    if (isLive) {
      if (!this.liveSessionActive) {
        void this.startSession(partyId)
          .then(() => {
            if (!config || !this.isCurrent(config, generation)) return;
            this.liveSessionActive = true;
            this.startPositionTicks(partyId);
          })
          .catch((error: unknown) => {
            if (!config || !this.isCurrent(config, generation)) return;
            this.ready = false;
            this.setPhase(config, 'retrying');
            this.scheduleReconnect(generation);
            logger.error('[StreamingOrchestrator] Failed to start session', error);
          });
      } else if (!this.positionInterval) {
        this.startPositionTicks(partyId);
      }
      return;
    }

    if (this.liveSessionActive) {
      if (this.config?.streamingSource === 'aimp') {
        const sessionOwnerAttempt = this.activeSessionStartAttemptByParty.get(partyId);
        void signalRService.endSession(partyId).then(
          () => {
            this.clearSessionStartOwner(partyId, sessionOwnerAttempt);
          },
          (err) => {
            logger.error('[StreamingOrchestrator] Failed to end AIMP session', err);
          },
        );
        void signalRService.resetPlaybackState(partyId).catch((err) => {
          logger.error('[StreamingOrchestrator] Failed to reset AIMP playback state', err);
        });
      }
      this.liveSessionActive = false;
    }

    this.stopPositionTicks();
  }

  async resetServerPlaybackState(): Promise<void> {
    const partyId = this.config?.partyId;
    if (!partyId) {
      return;
    }

    this.stopPositionTicks();
    await signalRService.resetPlaybackState(partyId);
  }

  async endServerSession(): Promise<void> {
    const partyId = this.config?.partyId;
    if (!partyId) {
      return;
    }

    const sessionOwnerAttempt = this.activeSessionStartAttemptByParty.get(partyId);
    await signalRService.endSessionOrThrow(partyId);
    this.clearSessionStartOwner(partyId, sessionOwnerAttempt);
    this.liveSessionActive = false;
    this.stopPositionTicks();
    await signalRService.resetPlaybackState(partyId);
  }

  publishFullState(): void {
    const config = this.config;
    const partyId = config?.partyId;
    if (!partyId || !this.ready || !signalRService.isServiceConnected()) {
      return;
    }
    void this.publishFullStateNow(partyId, config, this.connectGeneration).catch(
      (error: unknown) => {
        config.onPublishError?.('fullStatePublish', error);
      },
    );
  }

  get isRunning(): boolean {
    return this.running;
  }

  get isReady(): boolean {
    return this.ready;
  }

  get activeConfig(): StreamingOrchestratorConfig | null {
    return this.config;
  }

  private stopInternal(clearReconnectHandler: boolean): void {
    this.connectGeneration += 1;
    this.connectInFlight = null;
    this.running = false;
    this.liveSessionActive = false;
    this.ready = false;
    this.frozenStatePublishKey = null;

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.fullStateCoalesceTimer) {
      clearTimeout(this.fullStateCoalesceTimer);
      this.fullStateCoalesceTimer = null;
    }

    this.stopSourceSubscriptions();
    this.stopPositionTicks();

    if (clearReconnectHandler) {
      signalRService.setPartyReconnectHandler(null);
      signalRService.onReconnectionFailed(undefined);
    }
  }

  private scheduleReconnect(generation: number): void {
    if (!this.running || generation !== this.connectGeneration) {
      return;
    }

    if (this.reconnectTimeout) return;

    const attempt = this.reconnectAttempt++;
    const delay =
      RECONNECT_BACKOFF_MS[Math.min(attempt, RECONNECT_BACKOFF_MS.length - 1)] ?? 60_000;
    const jitteredDelay = attempt === 0 ? delay : delay * (0.8 + Math.random() * 0.4);

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      if (this.running && generation === this.connectGeneration) {
        void this.connectAndSubscribe();
      }
    }, jitteredDelay);
  }

  private handleHubReconnectionExhausted(): void {
    if (!this.running || !this.config) {
      return;
    }

    this.config.onReconnectionFailed?.();
    this.config.onConnectionStateChange?.(signalR.HubConnectionState.Disconnected);
    this.scheduleReconnect(this.connectGeneration);
  }

  private async connectAndSubscribe(): Promise<void> {
    const config = this.config;
    if (!config || !this.running) {
      return;
    }

    if (this.connectInFlight) {
      return this.connectInFlight;
    }

    const generation = this.connectGeneration;
    this.connectInFlight = this.doConnectAndSubscribe(config, generation).finally(() => {
      if (this.connectGeneration === generation) {
        this.connectInFlight = null;
      }
    });

    return this.connectInFlight;
  }

  private async doConnectAndSubscribe(
    config: StreamingOrchestratorConfig,
    generation: number,
  ): Promise<void> {
    const { partyId, onConnectionStateChange, onPartyNotFound } = config;

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    try {
      this.setPhase(config, 'connecting');
      const exists = await this.withTimeout(partyService.checkPartyExists(partyId), 'Party check');
      if (!this.isCurrent(config, generation)) {
        return;
      }

      if (!exists) {
        logger.warn(
          '[StreamingOrchestrator] Party does not exist on server, skipping SignalR connection',
        );
        onConnectionStateChange?.(signalR.HubConnectionState.Disconnected);
        onPartyNotFound?.();
        this.setPhase(config, 'blocked');
        return;
      }
    } catch (error) {
      if (!this.isCurrent(config, generation)) return;
      logger.error('[StreamingOrchestrator] Failed to check party existence:', error);
      onConnectionStateChange?.(signalR.HubConnectionState.Disconnected);
      if (isDefinitivePartyExistenceError(error)) {
        config.onConnectError?.(error);
        this.setPhase(config, 'blocked');
        return;
      }
      this.setPhase(config, 'retrying');
      this.scheduleReconnect(generation);
      return;
    }

    try {
      if (!signalRService.isServiceConnected()) {
        logger.info('[StreamingOrchestrator] Connecting to SignalR for party', partyId);
        onConnectionStateChange?.(signalR.HubConnectionState.Connecting);
        await this.withTimeout(signalRService.connect(), 'SignalR connect');
        if (!this.isCurrent(config, generation)) return;
      }

      this.setPhase(config, 'joining');
      await this.withTimeout(signalRService.joinPartyAsOrganizer(partyId), 'Organizer join');
      if (!this.isCurrent(config, generation)) return;

      this.startSourceSubscriptions(partyId);
      const live = config.broadcastSource.isLiveSessionActive();
      if (live && !this.liveSessionActive) {
        await this.startSession(partyId);
        if (!this.isCurrent(config, generation)) return;
        this.liveSessionActive = true;
        this.startPositionTicks(partyId);
      }
      if (!live) {
        this.liveSessionActive = false;
        this.stopPositionTicks();
      }
      this.setPhase(config, 'syncing');
      await this.synchronizeLatestState(config, generation);
      if (!this.isCurrent(config, generation)) return;
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = null;
      }
      this.reconnectAttempt = 0;
      this.ready = true;
      this.setPhase(config, 'ready');
      onConnectionStateChange?.(signalR.HubConnectionState.Connected);
    } catch (error) {
      if (!this.isCurrent(config, generation)) return;
      if (error instanceof Error && error.message === 'Organizer join timed out') {
        await signalRService.discardCurrentConnection?.();
        if (!this.isCurrent(config, generation)) return;
      }
      logger.error('[StreamingOrchestrator] Failed to connect to SignalR:', error);
      config.onConnectError?.(error);
      onConnectionStateChange?.(signalR.HubConnectionState.Disconnected);
      this.ready = false;
      this.setPhase(config, 'retrying');
      this.scheduleReconnect(generation);
    }
  }

  private async restoreAfterReconnect(partyId: string): Promise<void> {
    if (!this.running || this.config?.partyId !== partyId) {
      return;
    }

    await this.recover(false);
  }

  private async synchronizeLatestState(
    config: StreamingOrchestratorConfig,
    generation: number,
  ): Promise<void> {
    let syncedRevision = -1;
    while (this.isCurrent(config, generation) && syncedRevision !== this.sourceRevision) {
      const revision = this.sourceRevision;
      const published = await this.publishFullStateNow(config.partyId, config, generation);
      if (!this.isCurrent(config, generation)) return;
      if (!published) throw new Error('Full-state synchronization did not complete');
      syncedRevision = revision;
    }
  }

  private startSourceSubscriptions(partyId: string): void {
    const config = this.config;
    if (!config) {
      return;
    }

    this.stopSourceSubscriptions();

    this.sourceUnsubscribe = config.broadcastSource.subscribe(() => {
      this.sourceRevision += 1;
      this.scheduleFullStatePublish(partyId);
    });

    if (config.broadcastSource.sourceId === 'aimp') {
      this.playlistUnsubscribe = subscribeAimpPartyPlaylistSync(
        partyId,
        () => config.broadcastSource.getPlaylistForApi(),
        () => {
          this.scheduleFullStatePublish(partyId);
        },
        (error) => {
          config.onPublishError?.('playlistPublish', error);
        },
        (payload) => {
          config.onPlaylistSynced?.(payload);
        },
      );
      return;
    }

    this.playlistUnsubscribe = subscribePartyPlaylistSync(
      partyId,
      () => config.broadcastSource.getPlaylistForApi(),
      () => {
        this.scheduleFullStatePublish(partyId);
      },
      (error) => {
        config.onPublishError?.('playlistPublish', error);
      },
      (payload) => {
        config.onPlaylistSynced?.(payload);
      },
    );
  }

  private stopSourceSubscriptions(): void {
    if (this.sourceUnsubscribe) {
      this.sourceUnsubscribe();
      this.sourceUnsubscribe = null;
    }

    if (this.playlistUnsubscribe) {
      this.playlistUnsubscribe();
      this.playlistUnsubscribe = null;
    }
  }

  private scheduleFullStatePublish(partyId: string): void {
    if (this.fullStateCoalesceTimer) {
      return;
    }

    this.fullStateCoalesceTimer = setTimeout(() => {
      this.fullStateCoalesceTimer = null;
      const config = this.config;
      const generation = this.connectGeneration;
      if (!config || config.partyId !== partyId) return;
      void this.publishFullStateNow(partyId, config, generation)
        .then(() => {
          if (this.isCurrent(config, generation) && this.ready) {
            config.onConnectionStateChange?.(signalR.HubConnectionState.Connected);
          }
        })
        .catch((error: unknown) => {
          if (this.isCurrent(config, generation)) {
            config.onPublishError?.('fullStatePublish', error);
            this.ready = false;
            this.setPhase(config, 'retrying');
            this.scheduleReconnect(generation);
          }
        });
    }, FULL_STATE_COALESCE_MS);
  }

  private async publishFullStateNow(
    partyId: string,
    expectedConfig = this.config,
    generation = this.connectGeneration,
  ): Promise<boolean> {
    if (!signalRService.isServiceConnected()) {
      throw new Error('SignalR disconnected before full-state synchronization');
    }

    const source = expectedConfig?.broadcastSource;
    if (!source) {
      return false;
    }

    if (source.sourceId === 'aimp' && !source.isLiveSessionActive()) {
      return true;
    }

    const playbackState = source.getPlaybackStateDto();
    await this.withTimeout(signalRService.notifyStateChangedOrThrow(partyId), 'State notification');
    if (!expectedConfig || !this.isCurrent(expectedConfig, generation)) return false;
    if (!signalRService.isServiceConnected()) {
      throw new Error('SignalR disconnected before full-state publish');
    }
    await this.withTimeout(
      signalRService.updateFullStateOrThrow(partyId, playbackState),
      'Full-state publish',
    );
    if (!this.isCurrent(expectedConfig, generation)) return false;
    expectedConfig.onPublishSuccess?.();
    return true;
  }

  private startPositionTicks(partyId: string): void {
    this.stopPositionTicks();
    const config = this.config;
    const generation = this.connectGeneration;

    this.positionInterval = setInterval(() => {
      if (!signalRService.isServiceConnected() || !config || !this.isCurrent(config, generation)) {
        return;
      }

      const source = config.broadcastSource;
      if (!source.shouldSendPositionTicks()) {
        return;
      }

      const trackId = source.getCurrentTrackId();
      if (!trackId) {
        return;
      }

      const position = source.getPosition();
      void signalRService.updatePlaybackPosition(partyId, trackId, position);
    }, POSITION_TICK_MS);
  }

  private stopPositionTicks(): void {
    if (this.positionInterval) {
      clearInterval(this.positionInterval);
      this.positionInterval = null;
    }
  }
}

export const streamingOrchestrator = new StreamingOrchestrator();
