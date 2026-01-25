/**
 * Страница просмотра вечеринки
 * Отображает плейлист и состояние воспроизведения
 */
import React, { useEffect, useRef, useMemo, useCallback } from 'react';

import { PartyDisplay, PartyDisplayData } from '@cherryplay/components';
import type { PlaybackState, ThemeId } from '@cherryplay/components';

import { ConnectionStatus } from '../components/ConnectionStatus';
import { ErrorMessage } from '../components/ErrorMessage';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { usePartyState } from '../hooks/usePartyState';
import { useSignalR } from '../hooks/useSignalR';
import { signalRService } from '../services/signalRService';
import type { PlaybackStateDto, PlayerItemDto } from '../types/api';
import './PartyView.css';

function findTrackDuration(items: PlayerItemDto[], id: string): number | null {
  for (const item of items) {
    if (item.id === id && item.type === 'track') {
      return item.duration || null;
    }
    if (item.type === 'group' && item.items) {
      const duration = findTrackDuration(item.items, id);
      if (duration !== null) return duration;
    }
  }
  return null;
}

interface PartyViewProps {
  shortCode?: string;
  isDemo?: boolean;
  onBackToList?: () => void;
}

export const PartyView: React.FC<PartyViewProps> = ({
  shortCode,
  isDemo = false,
  onBackToList,
}) => {
  // Используем хук для управления состоянием вечеринки
  const partyState = usePartyState({ shortCode, isDemo });
  const {
    playlist,
    loading,
    error,
    partyName,
    partyId,
    themeId,
    customizationSettings,
    playbackState,
    isSessionActive,
    loadPlaylist,
    setPlaybackState,
    setIsSessionActive,
    setError,
  } = partyState;

  const playbackStateRef = useRef<PlaybackState | null>(null);
  const playlistRef = useRef(playlist);

  // Синхронизируем ref с state
  useEffect(() => {
    playbackStateRef.current = playbackState;
  }, [playbackState]);

  useEffect(() => {
    playlistRef.current = playlist;
  }, [playlist]);

  // Запрашивает полное состояние вечеринки через SignalR
  const requestFullState = useCallback(async () => {
    if (!shortCode) {
      console.log('[PartyView] requestFullState skipped - no shortCode');
      return;
    }

    if (!signalRService.isServiceConnected()) {
      console.warn('[PartyView] requestFullState skipped - SignalR not connected');
      return;
    }

    try {
      console.log('[PartyView] Requesting full state for shortCode:', shortCode);
      const state = await signalRService.requestFullState(shortCode);

      if (state) {
        console.log('[PartyView] Received full state:', {
          hasPlaylist: !!state.playlist,
          playlistItemsCount: state.playlist?.items?.length || 0,
          hasPlaybackState: !!state.playbackState,
          playbackState: state.playbackState
            ? {
                currentTrackId: state.playbackState.currentTrackId,
                status: state.playbackState.status,
                position: state.playbackState.position,
                duration: state.playbackState.duration,
                lastUpdatedAt: state.playbackState.lastUpdatedAt,
              }
            : null,
          isSessionActive: state.isSessionActive,
        });

        // Плейлист уже загружен при инициализации компонента
        // Обновление плейлиста происходит через событие OnPlaylistChanged
        // Здесь мы только обновляем состояние воспроизведения

        // Обновляем состояние воспроизведения
        if (state.playbackState) {
          // Сохраняем текущую позицию, если она более свежая
          const currentPosition =
            playbackStateRef.current?.position ?? state.playbackState.position;
          const currentLastUpdated = playbackStateRef.current?.lastUpdatedAt
            ? new Date(playbackStateRef.current.lastUpdatedAt).getTime()
            : 0;
          const newLastUpdated = new Date(state.playbackState.lastUpdatedAt).getTime();

          // Используем более свежую позицию
          const finalPosition =
            currentLastUpdated > newLastUpdated ? currentPosition : state.playbackState.position;

          const playbackState: PlaybackState = {
            currentTrackId: state.playbackState.currentTrackId,
            status: state.playbackState.status,
            position: finalPosition,
            duration: state.playbackState.duration,
            volume: state.playbackState.volume,
            mode: state.playbackState.mode,
            playedTrackIds: state.playbackState.playedTrackIds || [],
            disabledTrackIds: state.playbackState.disabledTrackIds || [],
            disabledGroupIds: state.playbackState.disabledGroupIds || [],
            lastUpdatedAt: state.playbackState.lastUpdatedAt,
          };
          console.log('[PartyView] Setting playback state from requestFullState:', playbackState);
          setPlaybackState(playbackState);
        }
        setIsSessionActive(state.isSessionActive);
      }
    } catch (err) {
      console.error('[PartyView] Failed to request full state:', err);
    }
  }, [shortCode, setPlaybackState, setIsSessionActive]);

  // Используем хук для управления SignalR подключением
  const signalR = useSignalR({
    shortCode,
    autoConnect: false, // Подключаемся вручную в useEffect
    onSessionStarted: useCallback(
      (_partyId: string) => {
        setIsSessionActive(true);
        requestFullState();
      },
      [setIsSessionActive, requestFullState],
    ),
    onSessionEnded: useCallback(
      (_partyId: string) => {
        setIsSessionActive(false);
        setPlaybackState(null);
      },
      [setIsSessionActive, setPlaybackState],
    ),
    onPlaybackPositionUpdated: useCallback(
      (_partyId: string, trackId: string, position: number) => {
        console.log('[PartyView] Processing OnPlaybackPositionUpdated:', {
          partyId: _partyId,
          trackId,
          position,
          currentPlaybackState: playbackStateRef.current
            ? {
                currentTrackId: playbackStateRef.current.currentTrackId,
                position: playbackStateRef.current.position,
                status: playbackStateRef.current.status,
              }
            : null,
          timestamp: new Date().toISOString(),
        });

        const trackDuration = playlistRef.current
          ? findTrackDuration(playlistRef.current.items, trackId)
          : null;

        // Обновляем позицию
        if (playbackStateRef.current) {
          const updatedState: PlaybackState = {
            ...playbackStateRef.current,
            currentTrackId: trackId,
            position,
            duration: trackDuration !== null ? trackDuration : playbackStateRef.current.duration,
            lastUpdatedAt: new Date().toISOString(),
          };
          console.log('[PartyView] Updating playback state (existing):', updatedState);
          setPlaybackState(updatedState);
        } else {
          // Если состояния еще нет, создаем минимальное состояние
          const newState: PlaybackState = {
            currentTrackId: trackId,
            status: 'playing',
            position,
            duration: trackDuration || 0,
            volume: 0.8,
            mode: 'session',
            playedTrackIds: [],
            disabledTrackIds: [],
            disabledGroupIds: [],
            lastUpdatedAt: new Date().toISOString(),
          };
          console.log('[PartyView] Creating new playback state:', newState);
          setPlaybackState(newState);
        }
      },
      [setPlaybackState],
    ),
    onFullStateUpdated: useCallback(
      (_partyId: string, state: PlaybackStateDto) => {
        console.log('[PartyView] Processing OnFullStateUpdated:', {
          partyId: _partyId,
          receivedState: {
            currentTrackId: state.currentTrackId,
            status: state.status,
            position: state.position,
            duration: state.duration,
            lastUpdatedAt: state.lastUpdatedAt,
          },
          currentPlaybackState: playbackStateRef.current
            ? {
                currentTrackId: playbackStateRef.current.currentTrackId,
                position: playbackStateRef.current.position,
                lastUpdatedAt: playbackStateRef.current.lastUpdatedAt,
              }
            : null,
          timestamp: new Date().toISOString(),
        });

        // Сохраняем текущую позицию, если она более свежая
        const currentPosition = playbackStateRef.current?.position ?? state.position;
        const currentLastUpdated = playbackStateRef.current?.lastUpdatedAt
          ? new Date(playbackStateRef.current.lastUpdatedAt).getTime()
          : 0;
        const newLastUpdated = new Date(state.lastUpdatedAt).getTime();

        // Используем более свежую позицию
        const finalPosition =
          currentLastUpdated > newLastUpdated ? currentPosition : state.position;

        const playbackState: PlaybackState = {
          currentTrackId: state.currentTrackId,
          status: state.status,
          position: finalPosition,
          duration: state.duration,
          volume: state.volume,
          mode: state.mode,
          playedTrackIds: state.playedTrackIds || [],
          disabledTrackIds: state.disabledTrackIds || [],
          disabledGroupIds: state.disabledGroupIds || [],
          lastUpdatedAt: state.lastUpdatedAt,
        };
        console.log('[PartyView] Setting playback state from OnFullStateUpdated:', playbackState);
        setPlaybackState(playbackState);
        setIsSessionActive(true);

        // Если duration равен 0 или не установлен, пытаемся получить из плейлиста
        if (
          (!playbackState.duration || playbackState.duration === 0) &&
          playbackState.currentTrackId &&
          playlistRef.current
        ) {
          const trackDuration = findTrackDuration(
            playlistRef.current.items,
            playbackState.currentTrackId,
          );
          if (trackDuration !== null && trackDuration > 0) {
            const updatedState = {
              ...playbackState,
              duration: trackDuration,
            };
            setPlaybackState(updatedState);
          }
        }
      },
      [setPlaybackState, setIsSessionActive],
    ),
    onStateChanged: useCallback(
      (_partyId: string) => {
        requestFullState();
      },
      [requestFullState],
    ),
    onPlaylistChanged: useCallback(
      (_partyId: string) => {
        console.log('[PartyView] Playlist changed, reloading...', {
          partyId: _partyId,
          timestamp: new Date().toISOString(),
        });
        loadPlaylist().catch((err) => {
          console.error('[PartyView] Failed to reload playlist:', err);
        });
      },
      [loadPlaylist],
    ),
    onConnectionStatusChanged: useCallback((_partyId: string, isOnline: boolean) => {
      console.log('[PartyView] Connection status changed:', {
        partyId: _partyId,
        isOnline,
        timestamp: new Date().toISOString(),
      });
      // Можно добавить дополнительную логику обработки офлайн-режима
      if (!isOnline) {
        // Организатор отключился - показываем последнее известное состояние
        console.log('[PartyView] Organizer disconnected, showing last known state');
      }
    }, []),
    onError: useCallback(
      (error: string) => {
        console.error('[SignalR] Error event received:', {
          error: error,
          timestamp: new Date().toISOString(),
          currentState: playbackStateRef.current
            ? {
                currentTrackId: playbackStateRef.current.currentTrackId,
                position: playbackStateRef.current.position,
                status: playbackStateRef.current.status,
              }
            : null,
        });
        setError(`Ошибка подключения: ${error}`);
      },
      [setError],
    ),
  });

  // Подключаемся к SignalR после загрузки плейлиста
  const connectingRef = useRef(false);
  const hasConnectedRef = useRef(false);
  const hasAttemptedConnectionRef = useRef(false);

  useEffect(() => {
    if (isDemo || !shortCode || loading) {
      return;
    }

    // Если уже подключены, просто запрашиваем состояние один раз
    if (signalR.isConnected) {
      if (!hasConnectedRef.current) {
        hasConnectedRef.current = true;
        // Запрашиваем состояние только один раз после подключения
        requestFullState();
      }
      return;
    }

    // Если уже была попытка подключения (успешная или нет), не пытаемся снова
    if (hasAttemptedConnectionRef.current) {
      return;
    }

    // Если уже идет подключение, не запускаем еще одно
    if (connectingRef.current) {
      return;
    }

    connectingRef.current = true;
    hasAttemptedConnectionRef.current = true;

    // Подключаемся автоматически после загрузки плейлиста
    signalR
      .connect()
      .then(() => {
        hasConnectedRef.current = true;
        // После подключения запрашиваем начальное состояние
        requestFullState();
        connectingRef.current = false;
      })
      .catch((err) => {
        console.error('[PartyView] Failed to connect to SignalR:', err);
        setError('Ошибка подключения к трансляции');
        connectingRef.current = false;
        // НЕ перезагружаем страницу и НЕ пытаемся подключиться снова автоматически
      });

    return () => {
      // Отключаемся при размонтировании
      connectingRef.current = false;
      // НЕ сбрасываем hasAttemptedConnectionRef и hasConnectedRef при cleanup,
      // чтобы не пытаться подключиться снова при следующем рендере
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shortCode, isDemo, loading]); // Убрали функции из зависимостей намеренно

  // Формируем единый объект данных для PartyDisplay
  const displayData: PartyDisplayData<ThemeId> = useMemo(() => {
    const data = {
      partyId: partyId || (isDemo ? 'demo' : 'unknown'),
      partyName: partyName || (isDemo ? 'Демо плейлист' : 'Плейлист вечеринки'),
      themeId,
      customizationSettings,
      playlist: playlist || { items: [], totalDuration: 0, totalTracks: 0 },
      playbackState: playbackState || null,
      isSessionActive,
    };
    console.log('[PartyView] displayData updated:', {
      partyId: data.partyId,
      partyName: data.partyName,
      themeId: data.themeId,
      playlistItemsCount: data.playlist.items.length,
      hasPlaybackState: !!data.playbackState,
      playbackState: data.playbackState
        ? {
            currentTrackId: data.playbackState.currentTrackId,
            status: data.playbackState.status,
            position: data.playbackState.position,
            duration: data.playbackState.duration,
          }
        : null,
      isSessionActive: data.isSessionActive,
      timestamp: new Date().toISOString(),
    });
    return data;
  }, [
    partyId,
    partyName,
    themeId,
    customizationSettings,
    playlist,
    playbackState,
    isSessionActive,
    isDemo,
  ]);

  const handleRetry = () => {
    loadPlaylist();
  };

  if (loading) {
    return (
      <div className="party-view">
        <LoadingSpinner message="Загрузка плейлиста..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="party-view">
        <ErrorMessage message={error} onRetry={handleRetry} />
      </div>
    );
  }

  if (!playlist) {
    return (
      <div className="party-view">
        <ErrorMessage message="Плейлист не найден" onRetry={handleRetry} />
      </div>
    );
  }

  return (
    <div className="party-view" data-theme={themeId}>
      <div className="party-view-container">
        <div className="party-view-header">
          <div className="party-view-header-controls">
            {onBackToList && (
              <button
                className="party-view-back-btn"
                onClick={onBackToList}
                title="Вернуться к списку вечеринок"
              >
                ← Назад к списку
              </button>
            )}
            {!isDemo && shortCode && (
              <ConnectionStatus
                status={signalR.connectionStatus}
                isSessionActive={isSessionActive}
                showSessionIndicator={true}
              />
            )}
          </div>
          {isDemo && <div className="party-view-demo-badge">Демо режим</div>}
        </div>
        <div className="party-view-content">
          <PartyDisplay data={displayData} showPlayer={!isDemo && shortCode !== undefined} />
        </div>
      </div>
    </div>
  );
};
