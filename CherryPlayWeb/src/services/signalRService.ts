/**
 * SignalR сервис для подключения к трансляции состояния вечеринки
 */
import * as signalR from '@microsoft/signalr';

import { API_ENDPOINTS, getSignalRUrl } from '../config/apiConfig';
import type { PlaybackStateDto, PartyStateDto } from '../types/api';
import { devLog } from '../utils/logger';

/** Логировать в консоль полученные сообщения SignalR (только в dev) */
function logReceived(eventName: string, ...args: unknown[]): void {
  if (import.meta.env.DEV) {
    console.log(`[SignalR] Received ${eventName}`, ...args);
  }
}

class SignalRService {
  private connection: signalR.HubConnection | null = null;
  private isConnected = false;
  private pendingCallbacks: Array<() => void> = [];
  // Один обработчик на событие (подписка только из useSignalR)
  private eventHandlers: Map<string, (...args: unknown[]) => void> = new Map();
  // Храним shortCode для повторного подключения к группе при переподключении
  private currentShortCode: string | null = null;

  private registerHandlers(): void {
    if (!this.connection) return;
    this.eventHandlers.forEach((handler, eventName) => {
      this.connection!.off(eventName);
      this.connection!.on(eventName, handler as (...args: unknown[]) => void);
    });
  }

  /**
   * Подключается к SignalR Hub
   */
  async connect(): Promise<void> {
    if (this.connection && this.isConnected) {
      return;
    }

    // Используем прямой URL к серверу (CORS настроен на сервере)
    const url = getSignalRUrl(API_ENDPOINTS.SIGNALR.PARTY_HUB);

    this.connection = new signalR.HubConnectionBuilder()
      .withUrl(url)
      .withAutomaticReconnect({
        nextRetryDelayInMilliseconds: (retryContext) => {
          if (retryContext.previousRetryCount < 5) {
            return 3000;
          }
          return null;
        },
      })
      .build();

    devLog('[SignalR Web] Setting up pending callbacks');
    this.pendingCallbacks.forEach((callback) => callback());
    this.pendingCallbacks = [];

    devLog('[SignalR Web] Restoring event handlers');
    this.registerHandlers();

    // Обработка событий подключения
    this.connection.onclose((error) => {
      this.isConnected = false;
      devLog('[SignalR Web] Connection closed:', error?.message);
    });

    this.connection.onreconnecting((error) => {
      devLog('[SignalR Web] Reconnecting...', error?.message);
    });

    this.connection.onreconnected(async (connectionId) => {
      this.isConnected = true;
      devLog('[SignalR Web] Reconnected:', connectionId);
      this.registerHandlers();

      // Повторно подключаемся к группе вечеринки, если был shortCode
      if (this.currentShortCode) {
        try {
          devLog('[SignalR Web] Re-joining party after reconnect:', this.currentShortCode);
          await this.joinPartyAsViewer(this.currentShortCode);
        } catch (err) {
          console.error('[SignalR Web] Failed to re-join party after reconnect:', err);
        }
      }
    });

    try {
      devLog('[SignalR Web] Starting connection...');
      await this.connection.start();
      this.isConnected = true;
      devLog('[SignalR Web] Connection started:', this.connection.connectionId);
    } catch (error) {
      console.error(
        '[SignalR Web] Failed to start connection:',
        error instanceof Error ? error.message : error,
      );
      await new Promise((resolve) => setTimeout(resolve, 500));
      if (this.connection?.state === signalR.HubConnectionState.Connected) {
        this.isConnected = true;
        devLog('[SignalR Web] Connection established via auto-reconnect');
        return;
      }
      throw error;
    }
  }

  /**
   * Отключается от SignalR Hub
   */
  async disconnect(): Promise<void> {
    if (this.connection) {
      devLog('[SignalR Web] Disconnecting...');
      await this.connection.stop();
      this.connection = null;
      this.isConnected = false;
    }
  }

  /**
   * Проверяет, подключен ли сервис
   */
  isServiceConnected(): boolean {
    const state = this.connection?.state;
    const isConnected = state === signalR.HubConnectionState.Connected;
    if (isConnected && !this.isConnected) {
      // Обновляем флаг если соединение установлено
      this.isConnected = true;
    }
    return isConnected;
  }

  /**
   * Ждет установления соединения
   */
  private async waitForConnection(maxWait: number = 5000): Promise<void> {
    const startTime = Date.now();
    while (!this.isServiceConnected() && Date.now() - startTime < maxWait) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    if (!this.isServiceConnected()) {
      throw new Error('SignalR connection not established');
    }
  }

  /**
   * Подключается к вечеринке как зритель
   */
  async joinPartyAsViewer(shortCode: string): Promise<void> {
    if (!this.connection) {
      throw new Error('SignalR connection not initialized');
    }

    await this.waitForConnection();
    this.currentShortCode = shortCode;
    await this.connection.invoke('JoinPartyAsViewer', shortCode);
    devLog('[SignalR Web] Joined party as viewer:', shortCode);
  }

  /**
   * Запрашивает полное состояние вечеринки
   */
  async requestFullState(shortCode: string): Promise<PartyStateDto | null> {
    if (!this.connection) {
      throw new Error('SignalR connection not initialized');
    }

    await this.waitForConnection();
    const result = await this.connection.invoke('RequestFullState', shortCode);
    devLog('[SignalR Web] Received full state:', shortCode, !!result?.playbackState);
    if (import.meta.env.DEV && result != null) {
      console.log('[SignalR] RequestFullState result:', {
        shortCode,
        hasPlaybackState: !!result.playbackState,
        playbackState: result.playbackState ?? null,
        hasPlaylist: !!result.playlist,
        playlistItemsCount: result.playlist?.items?.length ?? 0,
      });
    }
    return result;
  }

  /**
   * Подписывается на событие начала сессии
   * Можно вызывать до подключения - подписка установится когда соединение будет создано
   */
  onSessionStarted(callback: (partyId: string) => void): void {
    const eventName = 'OnSessionStarted';
    const wrappedCallback = (partyId: string) => {
      logReceived(eventName, { partyId });
      callback(partyId);
    };
    this.eventHandlers.set(eventName, wrappedCallback as (...args: unknown[]) => void);
    if (this.connection) {
      this.connection.off(eventName);
      this.connection.on(eventName, wrappedCallback);
    } else if (this.pendingCallbacks.length === 0) {
      this.pendingCallbacks.push(() => this.registerHandlers());
    }
  }

  /**
   * Подписывается на событие завершения сессии
   */
  onSessionEnded(callback: (partyId: string) => void): void {
    const eventName = 'OnSessionEnded';
    const wrappedCallback = (partyId: string) => {
      logReceived(eventName, { partyId });
      callback(partyId);
    };
    this.eventHandlers.set(eventName, wrappedCallback as (...args: unknown[]) => void);
    if (this.connection) {
      this.connection.off(eventName);
      this.connection.on(eventName, wrappedCallback);
    } else if (this.pendingCallbacks.length === 0) {
      this.pendingCallbacks.push(() => this.registerHandlers());
    }
  }

  /**
   * Подписывается на обновление позиции воспроизведения
   */
  onPlaybackPositionUpdated(
    callback: (partyId: string, trackId: string, position: number) => void,
  ): void {
    const eventName = 'OnPlaybackPositionUpdated';
    const wrappedCallback = (partyId: string, trackId: string, position: number) => {
      logReceived(eventName, { partyId, trackId, position });
      callback(partyId, trackId, position);
    };
    this.eventHandlers.set(eventName, wrappedCallback as (...args: unknown[]) => void);
    if (this.connection) {
      this.connection.off(eventName);
      this.connection.on(eventName, wrappedCallback);
    } else if (this.pendingCallbacks.length === 0) {
      this.pendingCallbacks.push(() => this.registerHandlers());
    }
  }

  /**
   * Подписывается на полное обновление состояния
   */
  onFullStateUpdated(callback: (partyId: string, state: PlaybackStateDto) => void): void {
    const eventName = 'OnFullStateUpdated';
    const wrappedCallback = (partyId: string, state: PlaybackStateDto) => {
      logReceived(eventName, {
        partyId,
        state: state ?? null,
        currentTrackId: state?.currentTrackId ?? null,
        status: state?.status ?? null,
        position: state?.position ?? null,
        duration: state?.duration ?? null,
      });
      callback(partyId, state);
    };
    this.eventHandlers.set(eventName, wrappedCallback as (...args: unknown[]) => void);
    if (this.connection) {
      this.connection.off(eventName);
      this.connection.on(eventName, wrappedCallback);
    } else if (this.pendingCallbacks.length === 0) {
      this.pendingCallbacks.push(() => this.registerHandlers());
    }
  }

  /**
   * Подписывается на уведомление об изменении состояния
   */
  onStateChanged(callback: (partyId: string) => void): void {
    const eventName = 'OnStateChanged';
    const wrappedCallback = (partyId: string) => {
      logReceived(eventName, { partyId });
      callback(partyId);
    };
    this.eventHandlers.set(eventName, wrappedCallback as (...args: unknown[]) => void);
    if (this.connection) {
      this.connection.off(eventName);
      this.connection.on(eventName, wrappedCallback);
    } else if (this.pendingCallbacks.length === 0) {
      this.pendingCallbacks.push(() => this.registerHandlers());
    }
  }

  /**
   * Подписывается на уведомление об изменении плейлиста
   */
  onPlaylistChanged(callback: (partyId: string) => void): void {
    const eventName = 'OnPlaylistChanged';
    const wrappedCallback = (partyId: string) => {
      logReceived(eventName, { partyId });
      callback(partyId);
    };
    this.eventHandlers.set(eventName, wrappedCallback as (...args: unknown[]) => void);
    if (this.connection) {
      this.connection.off(eventName);
      this.connection.on(eventName, wrappedCallback);
    } else if (this.pendingCallbacks.length === 0) {
      this.pendingCallbacks.push(() => this.registerHandlers());
    }
  }

  /**
   * Подписывается на изменение статуса подключения организатора
   */
  onConnectionStatusChanged(callback: (partyId: string, isOnline: boolean) => void): void {
    const eventName = 'OnConnectionStatusChanged';
    const wrappedCallback = (partyId: string, isOnline: boolean) => {
      logReceived(eventName, { partyId, isOnline });
      callback(partyId, isOnline);
    };
    this.eventHandlers.set(eventName, wrappedCallback as (...args: unknown[]) => void);
    if (this.connection) {
      this.connection.off(eventName);
      this.connection.on(eventName, wrappedCallback);
    } else if (this.pendingCallbacks.length === 0) {
      this.pendingCallbacks.push(() => this.registerHandlers());
    }
  }

  /**
   * Подписывается на ошибки
   */
  onError(callback: (error: string) => void): void {
    const eventName = 'Error';
    const wrappedCallback = (error: string) => {
      logReceived(eventName, { error });
      callback(error);
    };
    this.eventHandlers.set(eventName, wrappedCallback as (...args: unknown[]) => void);
    if (this.connection) {
      this.connection.off(eventName);
      this.connection.on(eventName, wrappedCallback);
    } else if (this.pendingCallbacks.length === 0) {
      this.pendingCallbacks.push(() => this.registerHandlers());
    }
  }

  /**
   * Отписывается от всех событий
   */
  off(eventName: string): void {
    if (this.connection) {
      this.connection.off(eventName);
    }
    // Удаляем обработчики из хранилища
    this.eventHandlers.delete(eventName);
  }
}

export const signalRService = new SignalRService();
