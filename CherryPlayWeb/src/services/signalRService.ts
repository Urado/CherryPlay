/**
 * SignalR сервис для подключения к трансляции состояния вечеринки
 */
import * as signalR from '@microsoft/signalr';

import type { PlaybackStateDto, PartyStateDto } from '../types/api';

// В продакшене используем относительные пути (nginx проксирует /partyHub на backend)
// В разработке используем VITE_API_URL или localhost:5000
const SERVER_URL =
  import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://localhost:5000');

class SignalRService {
  private connection: signalR.HubConnection | null = null;
  private isConnected = false;
  private pendingCallbacks: Array<() => void> = [];
  // Храним обработчики для восстановления при переподключении
  // SignalR требует тип (...args: any[]) => any для обработчиков событий
  private eventHandlers: Map<string, Array<(...args: unknown[]) => unknown>> = new Map();
  // Храним shortCode для повторного подключения к группе при переподключении
  private currentShortCode: string | null = null;

  /**
   * Подключается к SignalR Hub
   */
  async connect(): Promise<void> {
    if (this.connection && this.isConnected) {
      return;
    }

    // Используем прямой URL к серверу (CORS настроен на сервере)
    const url = `${SERVER_URL}/partyHub`;

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

    // Устанавливаем отложенные подписки
    console.log('[SignalR Web] Setting up pending callbacks:', {
      pendingCallbacksCount: this.pendingCallbacks.length,
      eventHandlersCount: this.eventHandlers.size,
      timestamp: new Date().toISOString(),
    });
    this.pendingCallbacks.forEach((callback) => callback());
    this.pendingCallbacks = [];

    // Устанавливаем все сохраненные обработчики
    console.log('[SignalR Web] Restoring event handlers:', {
      eventHandlersCount: this.eventHandlers.size,
      eventNames: Array.from(this.eventHandlers.keys()),
      timestamp: new Date().toISOString(),
    });
    this.eventHandlers.forEach((handlers, eventName) => {
      handlers.forEach((handler) => {
        if (this.connection) {
          this.connection.off(eventName);
          this.connection.on(eventName, handler as (...args: unknown[]) => void);
        }
      });
    });

    // Обработка событий подключения
    this.connection.onclose((error) => {
      this.isConnected = false;
      console.log('[SignalR Web] ← Connection closed:', {
        error: error ? error.message : 'No error',
        timestamp: new Date().toISOString(),
      });
    });

    this.connection.onreconnecting((error) => {
      console.log('[SignalR Web] ← Reconnecting...', {
        error: error ? error.message : 'No error',
        timestamp: new Date().toISOString(),
      });
    });

    this.connection.onreconnected(async (connectionId) => {
      this.isConnected = true;
      console.log('[SignalR Web] ← Reconnected:', {
        connectionId,
        timestamp: new Date().toISOString(),
      });
      console.log('[SignalR Web] Restoring event handlers...');
      // Восстанавливаем все обработчики при переподключении
      this.eventHandlers.forEach((handlers, eventName) => {
        if (this.connection) {
          this.connection.off(eventName);
          handlers.forEach((handler) => {
            this.connection!.on(eventName, handler);
          });
        }
      });

      // Повторно подключаемся к группе вечеринки, если был shortCode
      if (this.currentShortCode) {
        try {
          console.log('[SignalR Web] Re-joining party as viewer after reconnect:', {
            shortCode: this.currentShortCode,
            timestamp: new Date().toISOString(),
          });
          await this.joinPartyAsViewer(this.currentShortCode);
        } catch (err) {
          console.error('[SignalR Web] Failed to re-join party after reconnect:', err);
        }
      }
    });

    try {
      console.log('[SignalR Web] → Starting connection...');
      await this.connection.start();
      this.isConnected = true;
      console.log('[SignalR Web] ← Connection started successfully:', {
        connectionId: this.connection.connectionId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[SignalR Web] ✗ Failed to start connection:', {
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      });
      // Проверяем, не установилось ли соединение через автоматическое переподключение
      await new Promise((resolve) => setTimeout(resolve, 500));
      if (this.connection?.state === signalR.HubConnectionState.Connected) {
        this.isConnected = true;
        console.log('[SignalR Web] ← Connection established via auto-reconnect');
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
      console.log('[SignalR Web] → Disconnecting...');
      await this.connection.stop();
      this.connection = null;
      this.isConnected = false;
      console.log('[SignalR Web] ← Disconnected:', {
        timestamp: new Date().toISOString(),
      });
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
    this.currentShortCode = shortCode; // Сохраняем для повторного подключения
    console.log('[SignalR Web] → Sending JoinPartyAsViewer:', {
      shortCode,
      connectionId: this.connection.connectionId,
      connectionState: this.connection.state,
      timestamp: new Date().toISOString(),
    });
    await this.connection.invoke('JoinPartyAsViewer', shortCode);
    console.log('[SignalR Web] ← Successfully joined party as viewer:', {
      shortCode,
      connectionId: this.connection.connectionId,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Запрашивает полное состояние вечеринки
   */
  async requestFullState(shortCode: string): Promise<PartyStateDto | null> {
    if (!this.connection) {
      throw new Error('SignalR connection not initialized');
    }

    await this.waitForConnection();
    console.log('[SignalR Web] → Sending RequestFullState:', {
      shortCode,
      timestamp: new Date().toISOString(),
    });
    const result = await this.connection.invoke('RequestFullState', shortCode);
    console.log('[SignalR Web] ← Received full state:', {
      shortCode,
      hasPlaybackState: !!result?.playbackState,
      playbackState: result?.playbackState
        ? {
            currentTrackId: result.playbackState.currentTrackId,
            status: result.playbackState.status,
            position: result.playbackState.position,
            duration: result.playbackState.duration,
          }
        : null,
      hasPlaylist: !!result?.playlist,
      playlistItemsCount: result?.playlist?.items?.length || 0,
      timestamp: new Date().toISOString(),
    });
    return result;
  }

  /**
   * Подписывается на событие начала сессии
   * Можно вызывать до подключения - подписка установится когда соединение будет создано
   */
  onSessionStarted(callback: (partyId: string) => void): void {
    const eventName = 'OnSessionStarted';
    const wrappedCallback = (partyId: string) => {
      console.log('[SignalR Web] ← Received OnSessionStarted:', {
        partyId,
        timestamp: new Date().toISOString(),
      });
      callback(partyId);
    };

    // Сохраняем обработчик для восстановления при переподключении
    if (!this.eventHandlers.has(eventName)) {
      this.eventHandlers.set(eventName, []);
    }
    this.eventHandlers.get(eventName)!.push(wrappedCallback as (...args: unknown[]) => unknown);

    if (this.connection) {
      this.connection.off(eventName);
      this.eventHandlers.get(eventName)!.forEach((handler) => {
        this.connection!.on(eventName, handler as (...args: unknown[]) => void);
      });
    } else {
      this.pendingCallbacks.push(() => {
        if (this.connection) {
          this.connection.off(eventName);
          this.eventHandlers.get(eventName)!.forEach((handler) => {
            this.connection!.on(eventName, handler);
          });
        }
      });
    }
  }

  /**
   * Подписывается на событие завершения сессии
   */
  onSessionEnded(callback: (partyId: string) => void): void {
    const eventName = 'OnSessionEnded';
    const wrappedCallback = (partyId: string) => {
      console.log('[SignalR Web] ← Received OnSessionEnded:', {
        partyId,
        timestamp: new Date().toISOString(),
      });
      callback(partyId);
    };

    // Сохраняем обработчик для восстановления при переподключении
    if (!this.eventHandlers.has(eventName)) {
      this.eventHandlers.set(eventName, []);
    }
    this.eventHandlers.get(eventName)!.push(wrappedCallback as (...args: unknown[]) => unknown);

    if (this.connection) {
      this.connection.off(eventName);
      this.eventHandlers.get(eventName)!.forEach((handler) => {
        this.connection!.on(eventName, handler as (...args: unknown[]) => void);
      });
    } else {
      this.pendingCallbacks.push(() => {
        if (this.connection) {
          this.connection.off(eventName);
          this.eventHandlers.get(eventName)!.forEach((handler) => {
            this.connection!.on(eventName, handler);
          });
        }
      });
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
      console.log('[SignalR Web] ← Received OnPlaybackPositionUpdated:', {
        partyId,
        trackId,
        position,
        timestamp: new Date().toISOString(),
      });
      callback(partyId, trackId, position);
    };

    // Сохраняем обработчик для восстановления при переподключении
    if (!this.eventHandlers.has(eventName)) {
      this.eventHandlers.set(eventName, []);
    }
    this.eventHandlers.get(eventName)!.push(wrappedCallback as (...args: unknown[]) => unknown);

    if (this.connection) {
      this.connection.off(eventName);
      this.eventHandlers.get(eventName)!.forEach((handler) => {
        this.connection!.on(eventName, handler as (...args: unknown[]) => void);
      });
    } else {
      this.pendingCallbacks.push(() => {
        if (this.connection) {
          this.connection.off(eventName);
          this.eventHandlers.get(eventName)!.forEach((handler) => {
            this.connection!.on(eventName, handler);
          });
        }
      });
    }
  }

  /**
   * Подписывается на полное обновление состояния
   */
  onFullStateUpdated(callback: (partyId: string, state: PlaybackStateDto) => void): void {
    const eventName = 'OnFullStateUpdated';
    const wrappedCallback = (partyId: string, state: PlaybackStateDto) => {
      console.log('[SignalR Web] ← Received OnFullStateUpdated:', {
        partyId,
        playbackState: {
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
      callback(partyId, state);
    };

    // Сохраняем обработчик для восстановления при переподключении
    if (!this.eventHandlers.has(eventName)) {
      this.eventHandlers.set(eventName, []);
    }
    this.eventHandlers.get(eventName)!.push(wrappedCallback as (...args: unknown[]) => unknown);

    if (this.connection) {
      this.connection.off(eventName);
      this.eventHandlers.get(eventName)!.forEach((handler) => {
        this.connection!.on(eventName, handler as (...args: unknown[]) => void);
      });
    } else {
      this.pendingCallbacks.push(() => {
        if (this.connection) {
          this.connection.off(eventName);
          this.eventHandlers.get(eventName)!.forEach((handler) => {
            this.connection!.on(eventName, handler);
          });
        }
      });
    }
  }

  /**
   * Подписывается на уведомление об изменении состояния
   */
  onStateChanged(callback: (partyId: string) => void): void {
    const eventName = 'OnStateChanged';
    const wrappedCallback = (partyId: string) => {
      console.log('[SignalR Web] ← Received OnStateChanged:', {
        partyId,
        timestamp: new Date().toISOString(),
      });
      callback(partyId);
    };

    // Сохраняем обработчик для восстановления при переподключении
    if (!this.eventHandlers.has(eventName)) {
      this.eventHandlers.set(eventName, []);
    }
    this.eventHandlers.get(eventName)!.push(wrappedCallback as (...args: unknown[]) => unknown);

    if (this.connection) {
      this.connection.off(eventName);
      this.eventHandlers.get(eventName)!.forEach((handler) => {
        this.connection!.on(eventName, handler as (...args: unknown[]) => void);
      });
    } else {
      this.pendingCallbacks.push(() => {
        if (this.connection) {
          this.connection.off(eventName);
          this.eventHandlers.get(eventName)!.forEach((handler) => {
            this.connection!.on(eventName, handler);
          });
        }
      });
    }
  }

  /**
   * Подписывается на уведомление об изменении плейлиста
   */
  onPlaylistChanged(callback: (partyId: string) => void): void {
    const eventName = 'OnPlaylistChanged';
    const wrappedCallback = (partyId: string) => {
      console.log('[SignalR Web] ← Received OnPlaylistChanged:', {
        partyId,
        timestamp: new Date().toISOString(),
      });
      callback(partyId);
    };

    // Сохраняем обработчик для восстановления при переподключении
    if (!this.eventHandlers.has(eventName)) {
      this.eventHandlers.set(eventName, []);
    }
    this.eventHandlers.get(eventName)!.push(wrappedCallback as (...args: unknown[]) => unknown);

    if (this.connection) {
      // Удаляем старые обработчики перед добавлением нового (избегаем дублирования)
      this.connection.off(eventName);
      // Добавляем все сохраненные обработчики
      this.eventHandlers.get(eventName)!.forEach((handler) => {
        this.connection!.on(eventName, handler as (...args: unknown[]) => void);
      });
    } else {
      this.pendingCallbacks.push(() => {
        if (this.connection) {
          this.connection.off(eventName);
          this.eventHandlers.get(eventName)!.forEach((handler) => {
            this.connection!.on(eventName, handler);
          });
        }
      });
    }
  }

  /**
   * Подписывается на изменение статуса подключения организатора
   */
  onConnectionStatusChanged(callback: (partyId: string, isOnline: boolean) => void): void {
    const eventName = 'OnConnectionStatusChanged';
    const wrappedCallback = (partyId: string, isOnline: boolean) => {
      console.log('[SignalR Web] ← Received OnConnectionStatusChanged:', {
        partyId,
        isOnline,
        timestamp: new Date().toISOString(),
      });
      callback(partyId, isOnline);
    };

    // Сохраняем обработчик для восстановления при переподключении
    if (!this.eventHandlers.has(eventName)) {
      this.eventHandlers.set(eventName, []);
    }
    this.eventHandlers.get(eventName)!.push(wrappedCallback as (...args: unknown[]) => unknown);

    if (this.connection) {
      this.connection.off(eventName);
      this.eventHandlers.get(eventName)!.forEach((handler) => {
        this.connection!.on(eventName, handler as (...args: unknown[]) => void);
      });
    } else {
      this.pendingCallbacks.push(() => {
        if (this.connection) {
          this.connection.off(eventName);
          this.eventHandlers.get(eventName)!.forEach((handler) => {
            this.connection!.on(eventName, handler);
          });
        }
      });
    }
  }

  /**
   * Подписывается на ошибки
   */
  onError(callback: (error: string) => void): void {
    const eventName = 'Error';
    const wrappedCallback = (error: string) => {
      console.log('[SignalR Web] ← Received Error:', {
        error,
        timestamp: new Date().toISOString(),
      });
      callback(error);
    };

    // Сохраняем обработчик для восстановления при переподключении
    if (!this.eventHandlers.has(eventName)) {
      this.eventHandlers.set(eventName, []);
    }
    this.eventHandlers.get(eventName)!.push(wrappedCallback as (...args: unknown[]) => unknown);

    if (this.connection) {
      this.connection.off(eventName);
      this.eventHandlers.get(eventName)!.forEach((handler) => {
        this.connection!.on(eventName, handler as (...args: unknown[]) => void);
      });
    } else {
      this.pendingCallbacks.push(() => {
        if (this.connection) {
          this.connection.off(eventName);
          this.eventHandlers.get(eventName)!.forEach((handler) => {
            this.connection!.on(eventName, handler);
          });
        }
      });
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
