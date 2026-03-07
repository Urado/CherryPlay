/**
 * Страница просмотра вечеринки
 * Отображает плейлист и состояние воспроизведения
 */

import { PartyDisplay, PartyDisplayData } from '@cherryplay/components';
import type { PlaybackState, PartyThemeId } from '@cherryplay/components';
import React, { useEffect, useRef, useMemo, useCallback, useState } from 'react';

import { ErrorMessage } from '../components/ErrorMessage';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ROUTES } from '../constants/routes';
import { useAppConfig } from '../contexts/AppConfigContext';
import { usePartyState } from '../hooks/usePartyState';
import { useSignalR } from '../hooks/useSignalR';
import { signalRService } from '../services/signalRService';
import type { PlaybackStateDto, PlayerItemDto } from '../types/api';
import { devLog, devWarn } from '../utils/logger';
import { playbackStateFromDto } from '../utils/playbackState';
import './PartyView.css';

const DISCONNECT_FREEZE_MS = 60_000;
const SESSION_END_GRACE_MS = 1500;

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
  const { partyInfoPageEnabled } = useAppConfig();
  const partyState = usePartyState({ shortCode, isDemo });
  const {
    playlist,
    loading,
    error,
    partyName,
    partyTitle,
    partySubtitle,
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
  const disconnectFreezeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionEndGraceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isDisconnectFreezeActive, setIsDisconnectFreezeActive] = useState(false);

  // Clear both timers (on unmount or when live stream returns); also exits freeze display
  const clearSessionTimers = useCallback(() => {
    if (disconnectFreezeTimerRef.current !== null) {
      clearTimeout(disconnectFreezeTimerRef.current);
      disconnectFreezeTimerRef.current = null;
    }
    if (sessionEndGraceTimerRef.current !== null) {
      clearTimeout(sessionEndGraceTimerRef.current);
      sessionEndGraceTimerRef.current = null;
    }
    setIsDisconnectFreezeActive(false);
  }, []);

  // Clear timers on unmount
  useEffect(() => {
    return () => {
      clearSessionTimers();
    };
  }, [clearSessionTimers]);

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
      devLog('[PartyView] requestFullState skipped - no shortCode');
      return;
    }

    if (!signalRService.isServiceConnected()) {
      devWarn('[PartyView] requestFullState skipped - SignalR not connected');
      return;
    }

    clearSessionTimers();

    try {
      devLog('[PartyView] Requesting full state for shortCode:', shortCode);
      const state = await signalRService.requestFullState(shortCode);

      if (state) {
        if (state.playbackState) {
          const merged = playbackStateFromDto(state.playbackState, playbackStateRef.current);
          setPlaybackState(merged);
          if (import.meta.env.DEV) {
            console.log('[PartyView] Applied full state playback:', {
              currentTrackId: merged.currentTrackId,
              status: merged.status,
              position: merged.position,
              duration: merged.duration,
            });
          }
        }
        setIsSessionActive(state.isSessionActive);
      }
    } catch (err) {
      console.error(
        '[PartyView] Failed to request full state:',
        err instanceof Error ? err.message : err,
      );
    }
  }, [shortCode, clearSessionTimers, setPlaybackState, setIsSessionActive]);

  // Используем хук для управления SignalR подключением
  const signalR = useSignalR({
    shortCode,
    autoConnect: false, // Подключаемся вручную в useEffect
    onSessionStarted: useCallback(
      (_partyId: string) => {
        clearSessionTimers();
        setIsSessionActive(true);
        requestFullState();
      },
      [clearSessionTimers, setIsSessionActive, requestFullState],
    ),
    onSessionEnded: useCallback(
      (_partyId: string) => {
        clearSessionTimers();
        sessionEndGraceTimerRef.current = setTimeout(() => {
          sessionEndGraceTimerRef.current = null;
          setPlaybackState(null);
          setIsSessionActive(false);
        }, SESSION_END_GRACE_MS);
      },
      [clearSessionTimers, setIsSessionActive, setPlaybackState],
    ),
    onPlaybackPositionUpdated: useCallback(
      (_partyId: string, trackId: string, position: number) => {
        const trackDuration = playlistRef.current
          ? findTrackDuration(playlistRef.current.items, trackId)
          : null;

        if (playbackStateRef.current) {
          setPlaybackState({
            ...playbackStateRef.current,
            currentTrackId: trackId,
            position,
            duration: trackDuration !== null ? trackDuration : playbackStateRef.current.duration,
            lastUpdatedAt: new Date().toISOString(),
          });
        } else {
          setPlaybackState({
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
          });
        }
        if (import.meta.env.DEV) {
          console.log('[PartyView] Applied OnPlaybackPositionUpdated:', {
            trackId,
            position,
          });
        }
      },
      [setPlaybackState],
    ),
    onFullStateUpdated: useCallback(
      (_partyId: string, state: PlaybackStateDto) => {
        clearSessionTimers();
        const merged = playbackStateFromDto(state, playbackStateRef.current);
        setIsSessionActive(true);

        if (
          (!merged.duration || merged.duration === 0) &&
          merged.currentTrackId &&
          playlistRef.current
        ) {
          const trackDuration = findTrackDuration(playlistRef.current.items, merged.currentTrackId);
          if (trackDuration !== null && trackDuration > 0) {
            setPlaybackState({ ...merged, duration: trackDuration });
          } else {
            setPlaybackState(merged);
          }
        } else {
          setPlaybackState(merged);
        }
        if (import.meta.env.DEV) {
          console.log('[PartyView] Applied OnFullStateUpdated:', {
            currentTrackId: merged.currentTrackId,
            status: merged.status,
          });
        }
      },
      [clearSessionTimers, setPlaybackState, setIsSessionActive],
    ),
    onStateChanged: useCallback(
      (_partyId: string) => {
        requestFullState();
      },
      [requestFullState],
    ),
    onPlaylistChanged: useCallback(
      (_partyId: string) => {
        loadPlaylist({ silent: true }).catch((err) => {
          console.error(
            '[PartyView] Failed to reload playlist:',
            err instanceof Error ? err.message : err,
          );
        });
      },
      [loadPlaylist],
    ),
    onConnectionStatusChanged: useCallback(
      (_partyId: string, isOnline: boolean) => {
        devLog('[PartyView] Connection status changed:', _partyId, isOnline);
        if (!isOnline) {
          if (sessionEndGraceTimerRef.current !== null) {
            clearTimeout(sessionEndGraceTimerRef.current);
            sessionEndGraceTimerRef.current = null;
          }
          setIsSessionActive(false);
          setIsDisconnectFreezeActive(true);
          if (disconnectFreezeTimerRef.current !== null) {
            clearTimeout(disconnectFreezeTimerRef.current);
            disconnectFreezeTimerRef.current = null;
          }
          disconnectFreezeTimerRef.current = setTimeout(() => {
            disconnectFreezeTimerRef.current = null;
            setPlaybackState(null);
            setIsDisconnectFreezeActive(false);
          }, DISCONNECT_FREEZE_MS);
        }
      },
      [setIsSessionActive, setPlaybackState],
    ),
    onError: useCallback(
      (error: string) => {
        setError(`Ошибка подключения: ${error}`);
      },
      [setError],
    ),
  });

  // Подключаемся к SignalR после загрузки плейлиста
  const connectingRef = useRef(false);
  const hasConnectedRef = useRef(false);
  const hasAttemptedConnectionRef = useRef(false);
  const prevConnectionStatusRef = useRef(signalR.connectionStatus);

  // После (первого) подключения или восстановления соединения запрашиваем полное состояние
  useEffect(() => {
    if (isDemo || !shortCode) return;
    const prev = prevConnectionStatusRef.current;
    prevConnectionStatusRef.current = signalR.connectionStatus;
    const becameConnected =
      signalR.connectionStatus === 'connected' &&
      (prev === 'connecting' || prev === 'disconnected');
    if (becameConnected) {
      requestFullState();
    }
  }, [signalR.connectionStatus, shortCode, isDemo, requestFullState]);

  // Периодическая попытка переподключения раз в 30 с при отвале соединения
  const RECONNECT_INTERVAL_MS = 30_000;
  useEffect(() => {
    if (isDemo || !shortCode || signalR.connectionStatus !== 'disconnected') {
      return;
    }
    const id = setInterval(() => {
      if (signalR.connectionStatus !== 'disconnected') return;
      signalR.connect().catch((err) => {
        console.warn(
          '[PartyView] Periodic reconnect attempt failed:',
          err instanceof Error ? err.message : err,
        );
      });
    }, RECONNECT_INTERVAL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- зависим только от status и connect, не от всего signalR
  }, [isDemo, shortCode, signalR.connectionStatus, signalR.connect]);

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
        console.error(
          '[PartyView] Failed to connect to SignalR:',
          err instanceof Error ? err.message : err,
        );
        setError('Ошибка подключения к трансляции');
        connectingRef.current = false;
      });

    return () => {
      // Отключаемся при размонтировании
      connectingRef.current = false;
      // НЕ сбрасываем hasAttemptedConnectionRef и hasConnectedRef при cleanup,
      // чтобы не пытаться подключиться снова при следующем рендере
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shortCode, isDemo, loading]); // Убрали функции из зависимостей намеренно

  const displayData: PartyDisplayData<PartyThemeId> = useMemo(
    () => ({
      partyId: partyId || (isDemo ? 'demo' : 'unknown'),
      partyName: partyTitle || partyName || (isDemo ? 'Демо плейлист' : 'Плейлист вечеринки'),
      subtitle: partySubtitle ?? undefined,
      themeId,
      customizationSettings,
      playlist: playlist || { items: [], totalDuration: 0, totalTracks: 0 },
      playbackState: playbackState || null,
      isSessionActive,
    }),
    [
      partyId,
      partyTitle,
      partyName,
      partySubtitle,
      themeId,
      customizationSettings,
      playlist,
      playbackState,
      isSessionActive,
      isDemo,
    ],
  );

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
                type="button"
                className="party-view-back-btn"
                onClick={onBackToList}
                title="Список вечеринок"
              >
                ← Список вечеринок
              </button>
            )}
            {!isDemo && shortCode && partyInfoPageEnabled && (
              <a
                href={ROUTES.PARTY_INFO(shortCode)}
                className="party-view-info-btn"
                title="Информация о вечеринке"
              >
                Информация
              </a>
            )}
          </div>
          {isDemo && <div className="party-view-demo-badge">Демо режим</div>}
        </div>
        <div className="party-view-content">
          <PartyDisplay
            data={displayData}
            showPlayer={
              !isDemo &&
              !!shortCode &&
              ((signalR.connectionStatus === 'connected' && isSessionActive) ||
                (isDisconnectFreezeActive && playbackState != null))
            }
          />
        </div>
      </div>
    </div>
  );
};
