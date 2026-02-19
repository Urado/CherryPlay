/**
 * SignalR сервис для трансляции состояния воспроизведения
 * Использует @microsoft/signalr для подключения к серверу
 *
 * Включает:
 * - Управление подключением с защитой от race conditions
 * - Автоматическое переподключение
 * - Подписки на события сервера
 * - Интеграцию с stores для автоматической синхронизации состояния
 */

import * as signalR from '@microsoft/signalr';

import { getApiConfig } from '../config/apiConfig';
import { useAuthStore, usePlayerAudioStore, useProjectStore } from '../stores';
import { handleAuthError, isAuthError } from '../utils/authErrorHandler';
import { convertPlaylistForApi } from '../utils/partyUtils';
import { isTokenExpired } from '../utils/tokenUtils';

import { partyService } from './partyService';

export interface PlaybackStateDto {
  currentTrackId: string | null;
  status: 'idle' | 'playing' | 'paused' | 'ended';
  position: number;
  duration: number;
  volume: number;
  mode: 'preparation' | 'session';
  playedTrackIds: string[];
  disabledTrackIds: string[];
  disabledGroupIds: string[];
  lastUpdatedAt: string;
}

/**
 * Константы событий SignalR Hub
 */
const SignalREvents = {
  OnSessionStarted: 'OnSessionStarted',
  OnSessionEnded: 'OnSessionEnded',
  OnFullStateUpdated: 'OnFullStateUpdated',
  OnPlaybackPositionUpdated: 'OnPlaybackPositionUpdated',
  OnStateChanged: 'OnStateChanged',
  OnPlaylistChanged: 'OnPlaylistChanged',
  Error: 'Error',
} as const;

/**
 * Типы для обработчиков событий
 */
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

/**
 * Конфигурация переподключения
 */
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

  // Обработчики событий для возможности отписки
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

  // Подписки на stores
  private storeUnsubscribers: {
    audio?: () => void;
    session?: () => void;
    items?: () => void;
  } = {};

  // Состояние для отслеживания изменений
  private lastTrackId: string | null = null;
  private lastStatus: string = 'idle';
  private lastDisabledTrackIds: string = '';
  private lastDisabledGroupIds: string = '';

  // Интервал для обновления позиции
  private positionUpdateInterval: NodeJS.Timeout | null = null;
  private currentPartyId: string | null = null;
  private currentToken: string | undefined = undefined;

  /**
   * Проверяет, подключен ли сервис
   */
  isServiceConnected(): boolean {
    return (
      this.connection !== null && this.connection.state === signalR.HubConnectionState.Connected
    );
  }

  /**
   * Получает текущее состояние подключения
   */
  getConnectionState(): signalR.HubConnectionState | null {
    return this.connection?.state ?? null;
  }

  /**
   * Получает человекочитаемую причину отсутствия соединения
   */
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

    return null; // Соединение установлено или неизвестная ошибка
  }

  /**
   * Подключается к SignalR Hub
   */
  async connect(token?: string): Promise<void> {
    // Получаем токен из authStore, если не передан явно
    const authToken = token || useAuthStore.getState().accessToken;

    // Проверяем, не истек ли токен
    if (authToken && isTokenExpired(authToken)) {
      console.warn('[SignalR] Token expired, clearing auth');
      handleAuthError('Authentication token has expired. Please login again.');
      throw new Error('Authentication token has expired');
    }

    // Сохраняем токен для возможного переподключения
    if (authToken) {
      this.currentToken = authToken;
    }
    // Защита от race conditions
    if (this.isConnecting) {
      // Ждем завершения текущего подключения
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
      // Очищаем старое соединение, если есть
      if (this.connection) {
        await this.cleanupConnection();
      }

      const config = await getApiConfig();

      console.log('[SignalR] Starting connection to:', config.signalRUrl);

      // Настройка опций подключения с передачей токена через accessTokenFactory
      // SignalR автоматически добавит токен в query string (?access_token=...) для WebSocket
      // или в заголовок Authorization для HTTP транспортов (Long Polling, Server-Sent Events)
      const connectionOptions: signalR.IHttpConnectionOptions = {};
      if (authToken) {
        // Используем функцию, чтобы всегда получать актуальный токен
        // SignalR вызывает эту функцию при каждом подключении/переподключении
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
            return null; // Остановить попытки переподключения
          },
        })
        .build();

      // Устанавливаем обработчики событий подключения
      this.setupConnectionHandlers();

      // Устанавливаем обработчики событий Hub
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

  /**
   * Устанавливает обработчики событий подключения
   */
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

      // Проверяем токен при переподключении
      const currentToken = useAuthStore.getState().accessToken || this.currentToken;
      if (currentToken && isTokenExpired(currentToken)) {
        console.warn('[SignalR] Token expired during reconnect, clearing auth');
        handleAuthError('Authentication token has expired. Please login again.');
        await this.disconnect();
        return;
      }

      // Обновляем токен для переподключения
      if (currentToken) {
        this.currentToken = currentToken;
      }

      // Восстанавливаем обработчики событий Hub (они могли быть потеряны при переподключении)
      this.setupHubEventHandlers();

      // Восстанавливаем подписки и состояние после переподключения
      if (this.currentPartyId) {
        try {
          console.log('[SignalR] Restoring party connection after reconnect:', this.currentPartyId);

          // Переподключаемся к вечеринке как организатор (без повторного connect)
          if (this.connection && this.isServiceConnected() && this.currentToken) {
            await this.invokeWithLogging(
              'JoinPartyAsOrganizer',
              this.currentPartyId,
              this.currentToken,
            );
          }

          // Восстанавливаем подписки на stores
          this.startStoreSubscriptions(this.currentPartyId);

          // Восстанавливаем обновления позиции
          this.startPositionUpdates(this.currentPartyId);

          // Отправляем текущее состояние
          this.sendFullStateUpdate(this.currentPartyId);

          console.log('[SignalR] Party connection restored after reconnect');
        } catch (error) {
          console.error('[SignalR] Failed to restore party connection after reconnect:', error);
        }
      }
    });
  }

  /**
   * Устанавливает обработчики событий Hub
   * При повторном вызове удаляет старые обработчики перед установкой новых
   */
  private setupHubEventHandlers(): void {
    if (!this.connection) return;

    // Удаляем старые обработчики перед установкой новых (чтобы избежать дублирования)
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

  /**
   * Очищает соединение и все обработчики
   */
  private async cleanupConnection(): Promise<void> {
    if (this.connection) {
      // Удаляем все обработчики событий
      this.removeAllEventHandlers();

      try {
        await this.connection.stop();
      } catch (error) {
        console.error('[SignalR] Error stopping connection:', error);
      }

      this.connection = null;
    }
  }

  /**
   * Удаляет все обработчики событий Hub
   */
  private removeAllEventHandlers(): void {
    if (!this.connection) return;

    Object.values(SignalREvents).forEach((eventName) => {
      this.connection!.off(eventName);
    });
  }

  /**
   * Отключается от SignalR Hub
   */
  async disconnect(): Promise<void> {
    this.stopStoreSubscriptions();
    this.stopPositionUpdates();

    await this.cleanupConnection();
    this.currentPartyId = null;
    this.currentToken = undefined;

    console.log('[SignalR] Disconnected');
  }

  /**
   * Вспомогательный метод для логирования вызовов сервера
   */
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

  /**
   * Подключается к вечеринке как организатор
   */
  async joinPartyAsOrganizer(partyId: string, token?: string): Promise<void> {
    // Получаем токен из authStore, если не передан явно
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
      // Если ошибка авторизации, обрабатываем её
      if (isAuthError(error)) {
        handleAuthError(error instanceof Error ? error : String(error));
      }
      throw error;
    }
  }

  /**
   * Запускает сессию трансляции
   */
  async startSession(partyId: string): Promise<void> {
    if (!this.isServiceConnected()) {
      throw new Error('SignalR connection not established');
    }

    if (!this.connection) {
      throw new Error('SignalR connection is null');
    }

    // Проверяем токен перед началом сессии
    const token = useAuthStore.getState().accessToken || this.currentToken;
    if (!token) {
      const error = new Error('Authentication token is required to start session');
      handleAuthError(error);
      throw error;
    }

    if (isTokenExpired(token)) {
      const error = new Error('Authentication token has expired');
      handleAuthError(error);
      throw error;
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

  /**
   * Завершает сессию трансляции
   */
  async endSession(partyId: string): Promise<void> {
    if (!this.isServiceConnected() || !this.connection) {
      return; // Тихая ошибка, чтобы не прерывать очистку
    }

    try {
      await this.invokeWithLogging('EndSession', partyId);
      console.log('[SignalR] Session ended');
    } catch (error) {
      console.error('[SignalR] Failed to end session:', error);
    }
  }

  /**
   * Обновляет позицию воспроизведения
   */
  async updatePlaybackPosition(partyId: string, trackId: string, position: number): Promise<void> {
    if (!this.isServiceConnected() || !this.connection) {
      return; // Тихая ошибка, чтобы не прерывать воспроизведение
    }

    try {
      await this.invokeWithLogging('UpdatePlaybackPosition', partyId, trackId, position);
    } catch (error) {
      console.error('[SignalR] Failed to update playback position:', error);
    }
  }

  /**
   * Уведомляет об изменении состояния
   */
  async notifyStateChanged(partyId: string): Promise<void> {
    if (!this.isServiceConnected() || !this.connection) {
      return;
    }

    try {
      await this.invokeWithLogging('NotifyStateChanged', partyId);
    } catch (error) {
      console.error('[SignalR] Failed to notify state changed:', error);
    }
  }

  /**
   * Обновляет полное состояние воспроизведения
   */
  async updateFullState(partyId: string, state: PlaybackStateDto): Promise<void> {
    if (!this.isServiceConnected() || !this.connection) {
      return;
    }

    try {
      await this.invokeWithLogging('UpdateFullState', partyId, state);
    } catch (error) {
      console.error('[SignalR] Failed to update full state:', error);
    }
  }

  /**
   * Подписывается на событие начала сессии
   */
  onSessionStarted(handler: SessionStartedHandler): void {
    this.eventHandlers.onSessionStarted = handler;
    if (this.connection && this.isServiceConnected()) {
      this.connection.on(SignalREvents.OnSessionStarted, handler);
    }
  }

  /**
   * Подписывается на событие окончания сессии
   */
  onSessionEnded(handler: SessionEndedHandler): void {
    this.eventHandlers.onSessionEnded = handler;
    if (this.connection && this.isServiceConnected()) {
      this.connection.on(SignalREvents.OnSessionEnded, handler);
    }
  }

  /**
   * Подписывается на событие обновления полного состояния
   */
  onFullStateUpdated(handler: FullStateUpdatedHandler): void {
    this.eventHandlers.onFullStateUpdated = handler;
    if (this.connection && this.isServiceConnected()) {
      this.connection.on(SignalREvents.OnFullStateUpdated, handler);
    }
  }

  /**
   * Подписывается на событие обновления позиции воспроизведения
   */
  onPlaybackPositionUpdated(handler: PlaybackPositionUpdatedHandler): void {
    this.eventHandlers.onPlaybackPositionUpdated = handler;
    if (this.connection && this.isServiceConnected()) {
      this.connection.on(SignalREvents.OnPlaybackPositionUpdated, handler);
    }
  }

  /**
   * Подписывается на событие изменения состояния
   */
  onStateChanged(handler: StateChangedHandler): void {
    this.eventHandlers.onStateChanged = handler;
    if (this.connection && this.isServiceConnected()) {
      this.connection.on(SignalREvents.OnStateChanged, handler);
    }
  }

  /**
   * Подписывается на событие изменения плейлиста
   */
  onPlaylistChanged(handler: PlaylistChangedHandler): void {
    this.eventHandlers.onPlaylistChanged = handler;
    if (this.connection && this.isServiceConnected()) {
      this.connection.on(SignalREvents.OnPlaylistChanged, handler);
    }
  }

  /**
   * Подписывается на ошибки
   */
  onError(handler: ErrorHandler): void {
    this.eventHandlers.onError = handler;
  }

  /**
   * Подписывается на событие неудачного переподключения
   */
  onReconnectionFailed(handler: () => void): void {
    this.eventHandlers.onReconnectionFailed = handler;
  }

  /**
   * Отписывается от всех событий
   */
  removeAllHandlers(): void {
    this.removeAllEventHandlers();
    this.eventHandlers = {};
  }

  /**
   * Запускает автоматическую синхронизацию состояния с stores
   */
  startStoreSubscriptions(partyId: string): void {
    if (!this.isServiceConnected()) {
      console.warn('[SignalR] Cannot start store subscriptions - not connected');
      return;
    }

    this.currentPartyId = partyId;
    this.stopStoreSubscriptions(); // Очищаем предыдущие подписки

    console.log('[SignalR] Starting store subscriptions for party:', partyId);

    // Сбрасываем состояние отслеживания
    this.lastTrackId = null;
    this.lastStatus = 'idle';
    this.lastDisabledTrackIds = '';
    this.lastDisabledGroupIds = '';

    // Подписка на изменения состояния аудио
    this.storeUnsubscribers.audio = usePlayerAudioStore.subscribe((state) => {
      const currentTrack = state.currentTrack;
      const status = state.status;

      // Проверяем изменение трека или статуса
      if (currentTrack?.id !== this.lastTrackId || status !== this.lastStatus) {
        console.log('[SignalR] Audio state changed:', {
          oldTrackId: this.lastTrackId,
          newTrackId: currentTrack?.id || null,
          oldStatus: this.lastStatus,
          newStatus: status,
        });

        this.lastTrackId = currentTrack?.id || null;
        this.lastStatus = status;

        this.sendFullStateUpdate(partyId);
      }
    });

    // Подписка на изменения состояния сессии
    this.storeUnsubscribers.session = useProjectStore.subscribe((state) => {
      const disabledTrackIdsKey = state.sessionState.disabledTrackIds.sort().join(',');
      const disabledGroupIdsKey = state.sessionState.disabledGroupIds.sort().join(',');

      // Проверяем изменение отключенных треков или групп
      if (
        disabledTrackIdsKey !== this.lastDisabledTrackIds ||
        disabledGroupIdsKey !== this.lastDisabledGroupIds
      ) {
        console.log('[SignalR] Session state changed:', {
          oldDisabledTracks: this.lastDisabledTrackIds,
          newDisabledTracks: disabledTrackIdsKey,
          oldDisabledGroups: this.lastDisabledGroupIds,
          newDisabledGroups: disabledGroupIdsKey,
        });

        this.lastDisabledTrackIds = disabledTrackIdsKey;
        this.lastDisabledGroupIds = disabledGroupIdsKey;

        this.sendFullStateUpdate(partyId);
      }
    });

    // Подписка на изменения плейлиста (items)
    // Отправляет обновление плейлиста на сервер при ЛЮБОМ изменении в store
    // Срабатывает при вызове любых методов: addItem, removeItem, moveItem, createGroup,
    // ungroupGroup, setGroupName, addItemToGroup, removeItemFromGroup, moveItemInGroup,
    // updateTrackDuration, removeSelectedItems, moveSelectedItems и т.д.
    let isInitialCall = true;
    this.storeUnsubscribers.items = useProjectStore.subscribe((state) => {
      // Пропускаем первый вызов при инициализации подписки
      if (isInitialCall) {
        isInitialCall = false;
        return;
      }

      console.log('[SignalR] Playlist changed:', {
        itemsCount: state.items.length,
        timestamp: new Date().toISOString(),
      });

      // Преобразуем плейлист для API и отправляем на сервер через HTTP PUT
      const playlistForApi = convertPlaylistForApi(state.items);
      console.log('[SignalR] → Sending PUT request to update playlist:', {
        partyId,
        itemsCount: playlistForApi.items.length,
        timestamp: new Date().toISOString(),
      });
      partyService
        .updatePartyPlaylist(partyId, playlistForApi)
        .then(() => {
          console.log('[SignalR] ✓ Playlist updated successfully');
        })
        .catch((error) => {
          console.error('[SignalR] ✗ Failed to update playlist:', error);
        });

      // Также отправляем обновление состояния воспроизведения
      this.sendFullStateUpdate(partyId);
    });

    console.log('[SignalR] Store subscriptions started');
  }

  /**
   * Останавливает подписки на stores
   */
  stopStoreSubscriptions(): void {
    if (this.storeUnsubscribers.audio) {
      this.storeUnsubscribers.audio();
      this.storeUnsubscribers.audio = undefined;
    }

    if (this.storeUnsubscribers.session) {
      this.storeUnsubscribers.session();
      this.storeUnsubscribers.session = undefined;
    }

    if (this.storeUnsubscribers.items) {
      this.storeUnsubscribers.items();
      this.storeUnsubscribers.items = undefined;
    }

    console.log('[SignalR] Store subscriptions stopped');
  }

  /**
   * Запускает периодическое обновление позиции воспроизведения
   */
  startPositionUpdates(partyId: string, intervalMs: number = 1000): void {
    this.stopPositionUpdates();
    this.currentPartyId = partyId;

    this.positionUpdateInterval = setInterval(() => {
      if (!this.isServiceConnected() || !this.currentPartyId) {
        return;
      }

      const audioState = usePlayerAudioStore.getState();
      const currentTrack = audioState.currentTrack;
      const position = audioState.position;

      if (currentTrack) {
        this.updatePlaybackPosition(this.currentPartyId, currentTrack.id, position);
      }
    }, intervalMs);

    console.log('[SignalR] Position updates started');
  }

  /**
   * Останавливает обновление позиции
   */
  stopPositionUpdates(): void {
    if (this.positionUpdateInterval) {
      clearInterval(this.positionUpdateInterval);
      this.positionUpdateInterval = null;
      console.log('[SignalR] Position updates stopped');
    }
  }

  /**
   * Отправляет полное состояние на сервер
   */
  sendFullStateUpdate(partyId: string): void {
    if (!this.isServiceConnected() || !partyId) {
      console.warn('[SignalR] Cannot send state update - not connected or no partyId', {
        isConnected: this.isServiceConnected(),
        partyId,
      });
      return;
    }

    const audioState = usePlayerAudioStore.getState();
    const projectState = useProjectStore.getState();

    const playbackState: PlaybackStateDto = {
      currentTrackId: audioState.currentTrack?.id || null,
      status: audioState.status,
      position: audioState.position,
      duration: audioState.duration,
      volume: audioState.volume,
      mode: projectState.sessionState.mode,
      playedTrackIds: [...projectState.sessionState.playedTrackIds],
      disabledTrackIds: [...projectState.sessionState.disabledTrackIds],
      disabledGroupIds: [...projectState.sessionState.disabledGroupIds],
      lastUpdatedAt: new Date().toISOString(),
    };

    this.notifyStateChanged(partyId);
    this.updateFullState(partyId, playbackState);
  }
}

export const signalRService = new SignalRService();
