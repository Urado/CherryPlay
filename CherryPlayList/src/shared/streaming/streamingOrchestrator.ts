import * as signalR from '@microsoft/signalr';

import { partyService } from '../services/partyService';
import { signalRService } from '../services/signalRService';
import { logger } from '../utils';

import { AimpBroadcastSource } from './AimpBroadcastSource';
import { isStreamingNetworkEnabled } from './onlineNetworkPolicy';
import type { StreamingNetworkPolicySettings } from './onlineNetworkPolicy';
import { subscribeAimpPartyPlaylistSync, subscribePartyPlaylistSync } from './partyPlaylistSync';
import type { PlaybackBroadcastSource } from './PlaybackBroadcastSource';

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
}

const RECONNECT_DELAY_MS = 10_000;
const POSITION_TICK_MS = 1_000;
const FULL_STATE_COALESCE_MS = 50;

/**
 * Site Streamer orchestrator — SignalR connect, publish, position ticks, live playlist sync.
 * Live playlist PUT: `partyPlaylistSync` (not Party metadata hooks).
 */
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
  private frozenStatePublishKey: string | null = null;
  private lifecycleTail: Promise<void> = Promise.resolve();

  start(config: StreamingOrchestratorConfig): void {
    void this.enqueueLifecycle(() => this.applyStart(config));
  }

  stop(): void {
    void this.enqueueLifecycle(async () => {
      this.stopInternal(true);
    });
  }

  async teardown(): Promise<void> {
    return this.enqueueLifecycle(() => this.applyTeardown());
  }

  /**
   * Awaits any in-flight teardown, then starts with the next config.
   * Use when switching broadcast sources to avoid disconnecting a fresh connection.
   */
  async switchSource(config: StreamingOrchestratorConfig): Promise<void> {
    return this.enqueueLifecycle(() => this.applyStart(config));
  }

  private enqueueLifecycle<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.lifecycleTail.then(operation, operation);
    this.lifecycleTail = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  private async applyStart(config: StreamingOrchestratorConfig): Promise<void> {
    if (!isStreamingNetworkEnabled(config.networkSettings)) {
      await this.applyTeardown();
      return;
    }

    const previousConfig = this.config;
    const sameConfig =
      this.running &&
      previousConfig?.partyId === config.partyId &&
      previousConfig.broadcastSource.sourceId === config.broadcastSource.sourceId &&
      previousConfig.streamingSource === config.streamingSource;

    if (sameConfig) {
      this.config = config;
      return;
    }

    const switchingSource =
      previousConfig !== null &&
      (previousConfig.streamingSource !== config.streamingSource ||
        previousConfig.broadcastSource.sourceId !== config.broadcastSource.sourceId);

    this.config = config;

    if (switchingSource) {
      await this.applyTeardown(false);
    } else if (this.running) {
      this.stopInternal(false);
    }

    this.running = true;
    signalRService.setPartyReconnectHandler((partyId) => this.restoreAfterReconnect(partyId));
    await this.connectAndSubscribe();
  }

  private async applyTeardown(clearConfig = true): Promise<void> {
    const partyId = this.config?.partyId;
    const source = this.config?.broadcastSource;

    this.stopInternal(true);

    if (partyId && source?.isLiveSessionActive()) {
      await signalRService.endSession(partyId);
    }

    if (partyId && signalRService.isServiceConnected()) {
      await signalRService.resetPlaybackState(partyId);
    }

    await signalRService.disconnect();

    if (clearConfig) {
      this.config = null;
    }
  }

  reconnect(): void {
    if (!this.config || !this.running) {
      return;
    }
    void this.connectAndSubscribe();
  }

  syncAimpFrozenState(enableStreaming: boolean): void {
    const config = this.config;
    const partyId = config?.partyId;

    if (!partyId || !this.running || config.streamingSource !== 'aimp') {
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

    if (!signalRService.isServiceConnected()) {
      return;
    }

    void signalRService
      .notifyStateChangedOrThrow(partyId)
      .then(() => signalRService.updateFullStateOrThrow(partyId, snapshot.dto))
      .then(() => {
        config.onPublishSuccess?.();
      })
      .catch((error) => {
        logger.error('[StreamingOrchestrator] Failed to publish frozen AIMP state', error);
        config.onPublishError?.('fullStatePublish', error);
      });
  }

  syncLiveSession(isLive: boolean): void {
    const partyId = this.config?.partyId;
    if (!partyId || !this.running || !signalRService.isServiceConnected()) {
      return;
    }

    if (isLive) {
      if (!this.liveSessionActive) {
        this.startPositionTicks(partyId);
        signalRService
          .startSession(partyId)
          .catch((err) => logger.error('[StreamingOrchestrator] Failed to start session', err));
        this.liveSessionActive = true;
      } else if (!this.positionInterval) {
        this.startPositionTicks(partyId);
      }
      return;
    }

    if (this.liveSessionActive) {
      if (this.config?.streamingSource === 'aimp') {
        signalRService.endSession(partyId).catch((err) => {
          logger.error('[StreamingOrchestrator] Failed to end AIMP session', err);
        });
        signalRService.resetPlaybackState(partyId).catch((err) => {
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

  publishFullState(): void {
    const partyId = this.config?.partyId;
    if (!partyId || !signalRService.isServiceConnected()) {
      return;
    }
    this.publishFullStateNow(partyId);
  }

  get isRunning(): boolean {
    return this.running;
  }

  get activeConfig(): StreamingOrchestratorConfig | null {
    return this.config;
  }

  private stopInternal(clearReconnectHandler: boolean): void {
    this.connectGeneration += 1;
    this.connectInFlight = null;
    this.running = false;
    this.liveSessionActive = false;
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
    }
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
      const exists = await partyService.checkPartyExists(partyId);
      if (generation !== this.connectGeneration || !this.running) {
        return;
      }

      if (!exists) {
        logger.warn(
          '[StreamingOrchestrator] Party does not exist on server, skipping SignalR connection',
        );
        onPartyNotFound?.();
        onConnectionStateChange?.(signalR.HubConnectionState.Disconnected);
        return;
      }
    } catch (error) {
      logger.error('[StreamingOrchestrator] Failed to check party existence:', error);
      onConnectionStateChange?.(signalR.HubConnectionState.Disconnected);
      return;
    }

    if (signalRService.isServiceConnected()) {
      onConnectionStateChange?.(signalR.HubConnectionState.Connected);
      this.startSourceSubscriptions(partyId);
      this.syncLiveSession(config.broadcastSource.isLiveSessionActive());
      return;
    }

    try {
      logger.info('[StreamingOrchestrator] Connecting to SignalR for party', partyId);
      onConnectionStateChange?.(signalR.HubConnectionState.Connecting);

      await signalRService.connect();
      if (generation !== this.connectGeneration || !this.running) {
        return;
      }

      await signalRService.joinPartyAsOrganizer(partyId);
      if (generation !== this.connectGeneration || !this.running) {
        return;
      }

      this.startSourceSubscriptions(partyId);
      this.publishFullStateNow(partyId);
      this.syncLiveSession(config.broadcastSource.isLiveSessionActive());
      onConnectionStateChange?.(signalR.HubConnectionState.Connected);
    } catch (error) {
      logger.error('[StreamingOrchestrator] Failed to connect to SignalR:', error);
      config.onConnectError?.(error);
      onConnectionStateChange?.(signalR.HubConnectionState.Disconnected);

      if (this.running && generation === this.connectGeneration) {
        this.reconnectTimeout = setTimeout(() => {
          void this.connectAndSubscribe();
        }, RECONNECT_DELAY_MS);
      }
    }
  }

  private async restoreAfterReconnect(partyId: string): Promise<void> {
    if (!this.running || this.config?.partyId !== partyId) {
      return;
    }

    try {
      logger.info('[StreamingOrchestrator] Restoring party connection after reconnect:', partyId);
      this.startSourceSubscriptions(partyId);
      this.syncLiveSession(this.config.broadcastSource.isLiveSessionActive());
      this.publishFullStateNow(partyId);
      this.config.onConnectionStateChange?.(signalR.HubConnectionState.Connected);
    } catch (error) {
      logger.error('[StreamingOrchestrator] Failed to restore after reconnect:', error);
    }
  }

  /** CherryPlay Player or AIMP playlist changes → REST PUT + full-state coalesce. */
  private startSourceSubscriptions(partyId: string): void {
    const config = this.config;
    if (!config) {
      return;
    }

    this.stopSourceSubscriptions();

    this.sourceUnsubscribe = config.broadcastSource.subscribe(() => {
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
      );
      return;
    }

    this.playlistUnsubscribe = subscribePartyPlaylistSync(
      partyId,
      () => config.broadcastSource.getPlaylistForApi(),
      () => {
        this.scheduleFullStatePublish(partyId);
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
      this.publishFullStateNow(partyId);
    }, FULL_STATE_COALESCE_MS);
  }

  private publishFullStateNow(partyId: string): void {
    if (!signalRService.isServiceConnected()) {
      return;
    }

    const source = this.config?.broadcastSource;
    if (!source) {
      return;
    }

    if (source.sourceId === 'aimp' && !source.isLiveSessionActive()) {
      return;
    }

    const playbackState = source.getPlaybackStateDto();
    void signalRService
      .notifyStateChangedOrThrow(partyId)
      .then(() => signalRService.updateFullStateOrThrow(partyId, playbackState))
      .then(() => {
        this.config?.onPublishSuccess?.();
      })
      .catch((error) => {
        logger.error('[StreamingOrchestrator] Failed to publish full state', error);
        this.config?.onPublishError?.('fullStatePublish', error);
      });
  }

  private startPositionTicks(partyId: string): void {
    this.stopPositionTicks();

    this.positionInterval = setInterval(() => {
      if (!signalRService.isServiceConnected() || !this.config) {
        return;
      }

      const source = this.config.broadcastSource;
      if (!source.shouldSendPositionTicks()) {
        return;
      }

      const trackId = source.getCurrentTrackId();
      if (!trackId) {
        return;
      }

      const position = source.getPosition();
      signalRService.updatePlaybackPosition(partyId, trackId, position);
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
