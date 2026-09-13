import * as signalR from '@microsoft/signalr';

import { clearApiConfigCache, getApiConfig } from '../config/apiConfig';
import { type PlaybackStateDto } from '../contracts/playbackState';
import { useAuthStore } from '../stores';
import {
  handleAuthError,
  isAuthError,
  SESSION_EXPIRED_USER_MESSAGE,
} from '../utils/authErrorHandler';
import { isTokenExpired } from '../utils/tokenUtils';

export type { PlaybackStateDto, PlaybackWireStatus } from '../contracts/playbackState';

const SignalREvents = {
  OnSessionStarted: 'OnSessionStarted',
  OnSessionEnded: 'OnSessionEnded',
  OnFullStateUpdated: 'OnFullStateUpdated',
  OnPlaybackPositionUpdated: 'OnPlaybackPositionUpdated',
  OnStateChanged: 'OnStateChanged',
  OnPlaylistChanged: 'OnPlaylistChanged',
  Error: 'Error',
} as const;

export type SessionStartedHandler = (partyId: string) => void;
export type SessionEndedHandler = (partyId: string) => void;
export type FullStateUpdatedHandler = (partyId: string, state: PlaybackStateDto) => void;
export type PlaybackPositionUpdatedHandler = (
  partyId: string,
  trackId: string,
  position: number,
) => void;
export type StateChangedHandler = (partyId: string) => void;
export type PlaylistChangedHandler = (partyId: string) => void;
export type ErrorHandler = (error: Error) => void;

interface ReconnectConfig {
  maxAttempts: number;
  delayMs: number;
}

class SignalRService {
  private connection: signalR.HubConnection | null = null;
  private isConnecting = false;
  private reconnectConfig: ReconnectConfig = {
    maxAttempts: 5,
    delayMs: 3000,
  };

  
  private eventHandlers: {
    onSessionStarted?: SessionStartedHandler;
    onSessionEnded?: SessionEndedHandler;
    onFullStateUpdated?: FullStateUpdatedHandler;
    onPlaybackPositionUpdated?: PlaybackPositionUpdatedHandler;
    onStateChanged?: StateChangedHandler;
    onPlaylistChanged?: PlaylistChangedHandler;
    onError?: ErrorHandler;
    onReconnectionFailed?: () => void;
  } = {};

  
  private currentPartyId: string | null = null;
  private currentToken: string | undefined = undefined;
  private partyReconnectHandler: ((partyId: string) => Promise<void>) | null = null;

  
  setPartyReconnectHandler(handler: ((partyId: string) => Promise<void>) | null): void {
    this.partyReconnectHandler = handler;
  }

  
  isServiceConnected(): boolean {
    return (
      this.connection !== null && this.connection.state === signalR.HubConnectionState.Connected
    );
  }

  
  getConnectionState(): signalR.HubConnectionState | null {
    return this.connection?.state ?? null;
  }

  
  getConnectionErrorReason(): string | null {
    if (!this.currentPartyId) {
      return 'Нет вечеринки';
    }

    const state = this.getConnectionState();
    if (state === null) {
      return 'Нет вечеринки';
    }

    if (state === signalR.HubConnectionState.Disconnected) {
      return 'Ошибка соединения';
    }

    if (
      state === signalR.HubConnectionState.Disconnecting ||
      state === signalR.HubConnectionState.Reconnecting
    ) {
      return 'Ошибка соединения';
    }

    return null; 
  }

  
  async connect(token?: string): Promise<void> {
    
    const authToken = token || useAuthStore.getState().accessToken;

    
    if (authToken && isTokenExpired(authToken)) {
      console.warn('[SignalR] Token expired, clearing auth');
      handleAuthError('Authentication token has expired');
      throw new Error(SESSION_EXPIRED_USER_MESSAGE);
    }

    
    if (authToken) {
      this.currentToken = authToken;
    }
    
    if (this.isConnecting) {
      
      while (this.isConnecting) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      if (this.isServiceConnected()) {
        return;
      }
    }

    if (this.isServiceConnected()) {
      return;
    }

    this.isConnecting = true;

    try {
      
      if (this.connection) {
        await this.cleanupConnection();
      }

      
      clearApiConfigCache();
      const config = await getApiConfig();

      console.log('[SignalR] Starting connection to:', config.signalRUrl);

      
      
      
      const connectionOptions: signalR.IHttpConnectionOptions = {};
      if (authToken) {
        
        
        connectionOptions.accessTokenFactory = () => {
          const currentToken = useAuthStore.getState().accessToken || authToken;
          return Promise.resolve(currentToken || '');
        };
      }

      this.connection = new signalR.HubConnectionBuilder()
        .withUrl(config.signalRUrl, connectionOptions)
        .withAutomaticReconnect({
          nextRetryDelayInMilliseconds: (retryContext) => {
            if (retryContext.previousRetryCount < this.reconnectConfig.maxAttempts) {
              console.log(
                `[SignalR] Reconnecting attempt ${retryContext.previousRetryCount + 1}/${this.reconnectConfig.maxAttempts}`,
              );
              return this.reconnectConfig.delayMs;
            }
            console.error('[SignalR] Max reconnection attempts reached');
            if (this.eventHandlers.onReconnectionFailed) {
              this.eventHandlers.onReconnectionFailed();
            }
            return null; 
          },
        })
        .build();

      
      this.setupConnectionHandlers();

      
      this.setupHubEventHandlers();

      await this.connection.start();
      console.log('[SignalR] Successfully connected');
    } catch (error) {
      console.error('[SignalR] Failed to connect:', error);
      await this.cleanupConnection();
      throw error;
    } finally {
      this.isConnecting = false;
    }
  }

  
  private setupConnectionHandlers(): void {
    if (!this.connection) return;

    this.connection.onclose((error) => {
      console.log('[SignalR] Connection closed', error ? `with error: ${error.message}` : '');
      if (error && this.eventHandlers.onError) {
        this.eventHandlers.onError(new Error(error.message || 'Connection closed'));
      }
    });

    this.connection.onreconnecting((error) => {
      console.log('[SignalR] Reconnecting...', error ? `Error: ${error.message}` : '');
    });

    this.connection.onreconnected(async (connectionId) => {
      console.log('[SignalR] Reconnected with connection ID:', connectionId);

      
      const currentToken = useAuthStore.getState().accessToken || this.currentToken;
      if (currentToken && isTokenExpired(currentToken)) {
        console.warn('[SignalR] Token expired during reconnect, clearing auth');
        handleAuthError('Authentication token has expired');
        await this.disconnect();
        return;
      }

      
      if (currentToken) {
        this.currentToken = currentToken;
      }

      
      this.setupHubEventHandlers();

      
      if (this.currentPartyId) {
        try {
          console.log('[SignalR] Restoring party connection after reconnect:', this.currentPartyId);

          
          if (this.connection && this.isServiceConnected() && this.currentToken) {
            await this.invokeWithLogging(
              'JoinPartyAsOrganizer',
              this.currentPartyId,
              this.currentToken,
            );
          }

          if (this.partyReconnectHandler) {
            await this.partyReconnectHandler(this.currentPartyId);
          }

          console.log('[SignalR] Party connection restored after reconnect');
        } catch (error) {
          console.error('[SignalR] Failed to restore party connection after reconnect:', error);
        }
      }
    });
  }

  
  private setupHubEventHandlers(): void {
    if (!this.connection) return;

    
    Object.values(SignalREvents).forEach((eventName) => {
      this.connection!.off(eventName);
    });

    if (this.eventHandlers.onSessionStarted) {
      this.connection.on(SignalREvents.OnSessionStarted, (partyId: string) => {
        console.log('[SignalR] ← Received OnSessionStarted:', {
          partyId,
          timestamp: new Date().toISOString(),
        });
        this.eventHandlers.onSessionStarted!(partyId);
      });
    }

    if (this.eventHandlers.onSessionEnded) {
      this.connection.on(SignalREvents.OnSessionEnded, (partyId: string) => {
        console.log('[SignalR] ← Received OnSessionEnded:', {
          partyId,
          timestamp: new Date().toISOString(),
        });
        this.eventHandlers.onSessionEnded!(partyId);
      });
    }

    if (this.eventHandlers.onFullStateUpdated) {
      this.connection.on(
        SignalREvents.OnFullStateUpdated,
        (partyId: string, state: PlaybackStateDto) => {
          console.log('[SignalR] ← Received OnFullStateUpdated:', {
            partyId,
            state: {
              currentTrackId: state.currentTrackId,
              status: state.status,
              position: state.position,
              duration: state.duration,
              volume: state.volume,
              mode: state.mode,
              playedTrackIds: state.playedTrackIds?.length || 0,
              disabledTrackIds: state.disabledTrackIds?.length || 0,
              disabledGroupIds: state.disabledGroupIds?.length || 0,
              lastUpdatedAt: state.lastUpdatedAt,
            },
            timestamp: new Date().toISOString(),
          });
          this.eventHandlers.onFullStateUpdated!(partyId, state);
        },
      );
    }

    if (this.eventHandlers.onPlaybackPositionUpdated) {
      this.connection.on(
        SignalREvents.OnPlaybackPositionUpdated,
        (partyId: string, trackId: string, position: number) => {
          console.log('[SignalR] ← Received OnPlaybackPositionUpdated:', {
            partyId,
            trackId,
            position,
            timestamp: new Date().toISOString(),
          });
          this.eventHandlers.onPlaybackPositionUpdated!(partyId, trackId, position);
        },
      );
    }

    if (this.eventHandlers.onStateChanged) {
      this.connection.on(SignalREvents.OnStateChanged, (partyId: string) => {
        console.log('[SignalR] ← Received OnStateChanged:', {
          partyId,
          timestamp: new Date().toISOString(),
        });
        this.eventHandlers.onStateChanged!(partyId);
      });
    }

    if (this.eventHandlers.onPlaylistChanged) {
      this.connection.on(SignalREvents.OnPlaylistChanged, (partyId: string) => {
        console.log('[SignalR] ← Received OnPlaylistChanged:', {
          partyId,
          timestamp: new Date().toISOString(),
        });
        this.eventHandlers.onPlaylistChanged!(partyId);
      });
    }

    if (this.eventHandlers.onError) {
      this.connection.on(SignalREvents.Error, (message: string) => {
        console.log('[SignalR] ← Received Error:', {
          message,
          timestamp: new Date().toISOString(),
        });
        this.eventHandlers.onError!(new Error(message));
      });
    }
  }

  
  private async cleanupConnection(): Promise<void> {
    if (this.connection) {
      
      this.removeAllEventHandlers();

      try {
        await this.connection.stop();
      } catch (error) {
        console.error('[SignalR] Error stopping connection:', error);
      }

      this.connection = null;
    }
  }

  
  private removeAllEventHandlers(): void {
    if (!this.connection) return;

    Object.values(SignalREvents).forEach((eventName) => {
      this.connection!.off(eventName);
    });
  }

  
  async disconnect(): Promise<void> {
    await this.cleanupConnection();
    this.currentPartyId = null;
    this.currentToken = undefined;

    console.log('[SignalR] Disconnected');
  }

  
  private async invokeWithLogging<T>(methodName: string, ...args: unknown[]): Promise<T> {
    if (!this.connection) {
      throw new Error('SignalR connection is null');
    }

    const logData = {
      method: methodName,
      args: args.length > 0 ? args : undefined,
      timestamp: new Date().toISOString(),
    };

    console.log(`[SignalR] → Invoking ${methodName}:`, logData);

    try {
      const result = await this.connection.invoke<T>(methodName, ...args);
      console.log(`[SignalR] ✓ ${methodName} succeeded`, {
        method: methodName,
        timestamp: new Date().toISOString(),
      });
      return result;
    } catch (error) {
      console.error(`[SignalR] ✗ ${methodName} failed:`, {
        method: methodName,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      });
      throw error;
    }
  }

  
  async joinPartyAsOrganizer(partyId: string, token?: string): Promise<void> {
    
    const authToken = token || useAuthStore.getState().accessToken;

    if (!authToken) {
      throw new Error('Authentication token is required to join as organizer');
    }

    if (!this.isServiceConnected()) {
      console.log('[SignalR] Connection not established, connecting...');
      await this.connect(authToken);
    }

    if (!this.connection || !this.isServiceConnected()) {
      throw new Error('SignalR connection not established');
    }

    console.log('[SignalR] Joining party as organizer:', {
      partyId,
      hasToken: !!authToken,
    });

    try {
      await this.invokeWithLogging('JoinPartyAsOrganizer', partyId, authToken);
      this.currentPartyId = partyId;
      console.log('[SignalR] Successfully joined party as organizer');
    } catch (error) {
      console.error('[SignalR] Failed to join party as organizer:', error);
      
      if (isAuthError(error)) {
        handleAuthError(error instanceof Error ? error : String(error));
      }
      throw error;
    }
  }

  
  async startSession(partyId: string): Promise<void> {
    if (!this.isServiceConnected()) {
      throw new Error('SignalR connection not established');
    }

    if (!this.connection) {
      throw new Error('SignalR connection is null');
    }

    
    const token = useAuthStore.getState().accessToken || this.currentToken;
    if (!token) {
      const error = new Error('Authentication token is required to start session');
      handleAuthError(error);
      throw error;
    }

    if (isTokenExpired(token)) {
      handleAuthError('Authentication token has expired');
      throw new Error(SESSION_EXPIRED_USER_MESSAGE);
    }

    console.log('[SignalR] Starting session:', { partyId });

    try {
      await this.invokeWithLogging('StartSession', partyId);
      console.log('[SignalR] Session started successfully');
    } catch (error) {
      console.error('[SignalR] Failed to start session:', error);
      if (isAuthError(error)) {
        handleAuthError(error instanceof Error ? error : String(error));
      }
      throw error;
    }
  }

  
  async endSession(partyId: string): Promise<void> {
    if (!this.isServiceConnected() || !this.connection) {
      return; 
    }

    try {
      await this.invokeWithLogging('EndSession', partyId);
      console.log('[SignalR] Session ended');
    } catch (error) {
      console.error('[SignalR] Failed to end session:', error);
    }
  }

  
  async resetPlaybackState(partyId: string): Promise<void> {
    if (!this.isServiceConnected() || !this.connection) {
      throw new Error('Нет подключения к серверу');
    }

    await this.invokeWithLogging('ResetPlaybackState', partyId);
    console.log('[SignalR] Playback state reset');
  }

  
  async updatePlaybackPosition(partyId: string, trackId: string, position: number): Promise<void> {
    if (!this.isServiceConnected() || !this.connection) {
      return; 
    }

    try {
      await this.invokeWithLogging('UpdatePlaybackPosition', partyId, trackId, position);
    } catch (error) {
      console.error('[SignalR] Failed to update playback position:', error);
    }
  }

  
  async notifyStateChanged(partyId: string): Promise<void> {
    try {
      await this.notifyStateChangedOrThrow(partyId);
    } catch (error) {
      console.error('[SignalR] Failed to notify state changed:', error);
    }
  }

  async notifyStateChangedOrThrow(partyId: string): Promise<void> {
    if (!this.isServiceConnected() || !this.connection) {
      throw new Error('SignalR connection not established');
    }

    await this.invokeWithLogging('NotifyStateChanged', partyId);
  }

  
  async updateFullState(partyId: string, state: PlaybackStateDto): Promise<void> {
    try {
      await this.updateFullStateOrThrow(partyId, state);
    } catch (error) {
      console.error('[SignalR] Failed to update full state:', error);
    }
  }

  async updateFullStateOrThrow(partyId: string, state: PlaybackStateDto): Promise<void> {
    if (!this.isServiceConnected() || !this.connection) {
      throw new Error('SignalR connection not established');
    }

    await this.invokeWithLogging('UpdateFullState', partyId, state);
  }

  
  onSessionStarted(handler: SessionStartedHandler): void {
    this.eventHandlers.onSessionStarted = handler;
    if (this.connection && this.isServiceConnected()) {
      this.connection.on(SignalREvents.OnSessionStarted, handler);
    }
  }

  
  onSessionEnded(handler: SessionEndedHandler): void {
    this.eventHandlers.onSessionEnded = handler;
    if (this.connection && this.isServiceConnected()) {
      this.connection.on(SignalREvents.OnSessionEnded, handler);
    }
  }

  
  onFullStateUpdated(handler: FullStateUpdatedHandler): void {
    this.eventHandlers.onFullStateUpdated = handler;
    if (this.connection && this.isServiceConnected()) {
      this.connection.on(SignalREvents.OnFullStateUpdated, handler);
    }
  }

  
  onPlaybackPositionUpdated(handler: PlaybackPositionUpdatedHandler): void {
    this.eventHandlers.onPlaybackPositionUpdated = handler;
    if (this.connection && this.isServiceConnected()) {
      this.connection.on(SignalREvents.OnPlaybackPositionUpdated, handler);
    }
  }

  
  onStateChanged(handler: StateChangedHandler): void {
    this.eventHandlers.onStateChanged = handler;
    if (this.connection && this.isServiceConnected()) {
      this.connection.on(SignalREvents.OnStateChanged, handler);
    }
  }

  
  onPlaylistChanged(handler: PlaylistChangedHandler): void {
    this.eventHandlers.onPlaylistChanged = handler;
    if (this.connection && this.isServiceConnected()) {
      this.connection.on(SignalREvents.OnPlaylistChanged, handler);
    }
  }

  
  onError(handler: ErrorHandler): void {
    this.eventHandlers.onError = handler;
  }

  
  onReconnectionFailed(handler: (() => void) | null | undefined): void {
    this.eventHandlers.onReconnectionFailed = handler ?? undefined;
  }

  
  removeAllHandlers(): void {
    this.removeAllEventHandlers();
    this.eventHandlers = {};
  }
}

export const signalRService = new SignalRService();
