import { Button, Icon } from '@cherryplay/components';
import ListIcon from '@mui/icons-material/List';
import React, { useEffect, useMemo, useState } from 'react';

import { WorkspaceId } from '@core/types/workspace';
import { EmptyState, ItemList, ListRowCompound } from '@shared/components';
import { type AimpPlaylistTrackDto } from '@shared/contracts/aimp';
import { useAimpStore, useProjectStore, useSettingsStore, useUIStore } from '@shared/stores';
import {
  canAdvanceAimpPlayback,
  canStartAimpLiveStream,
  formatPlayerTime,
  formatTrackDuration,
  getAimpAvailability,
  getAimpCurrentTrack,
  getAimpEffectiveProgressMs,
  isAimpDegraded,
} from '@shared/utils';
interface AimpViewProps {
  workspaceId: WorkspaceId;
  zoneId: string;
  embedded?: boolean;
}

interface AimpPlaylistRowProps {
  track: AimpPlaylistTrackDto;
  index: number;
  isActive: boolean;
}

const STATUS_LABELS: Record<string, string> = {
  disconnected: 'Отключено',
  listening: 'Ожидание плагина',
  connected: 'Подключено',
  stale: 'Соединение устарело',
};

const PUBLISHING_STATUS_LABELS: Record<string, string> = {
  idle: 'Не подготовлен',
  connecting: 'Подключение',
  ready: 'Готов',
  error: 'Ошибка',
};

const AimpPlaylistRow: React.FC<AimpPlaylistRowProps> = ({ track, index, isActive }) => {
  const displayName =
    track.artist && track.artist.trim().length > 0
      ? `${track.artist} - ${track.title}`
      : track.title;

  return (
    <ListRowCompound
      id={track.trackKey}
      isActive={isActive}
      isCurrent={isActive}
      isLocked
      draggable={false}
      onClick={() => undefined}
    >
      <ListRowCompound.Index value={index} />
      <ListRowCompound.Content>{displayName}</ListRowCompound.Content>
      <ListRowCompound.Secondary>
        {typeof track.durationMs === 'number'
          ? formatTrackDuration(track.durationMs / 1000)
          : '--:--'}
      </ListRowCompound.Secondary>
    </ListRowCompound>
  );
};

function useProgressClock(isActive: boolean): number {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!isActive) {
      return;
    }

    const intervalId = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, [isActive]);

  return nowMs;
}

export const AimpView: React.FC<AimpViewProps> = ({ embedded = false }) => {
  const bridgeState = useAimpStore((state) => state.bridgeState);
  const publishingBridgeReady = useAimpStore((state) => state.publishingBridgeReady);
  const publishingPath = useAimpStore((state) => state.publishingPath);
  const setLiveStreamStarted = useAimpStore((state) => state.setLiveStreamStarted);
  const enableStreaming = useSettingsStore((state) => state.enableStreaming);
  const streamingSource = useSettingsStore((state) => state.streamingSource);
  const linkedPartyId = useProjectStore((state) => state.meta.linkedParty?.id ?? null);
  const addNotification = useUIStore((state) => state.addNotification);
  const [isSubmittingLiveStream, setIsSubmittingLiveStream] = useState(false);

  const availability = getAimpAvailability(bridgeState);
  const currentTrack = getAimpCurrentTrack(bridgeState);
  const isProgressAdvancing = canAdvanceAimpPlayback(
    bridgeState.connection.phase,
    bridgeState.playbackSnapshot?.status,
  );
  const nowMs = useProgressClock(isProgressAdvancing);
  const progressMs = getAimpEffectiveProgressMs(bridgeState, nowMs);
  const durationMs = bridgeState.playbackSnapshot?.durationMs ?? currentTrack?.durationMs ?? 0;
  const progressPercent =
    durationMs > 0 ? Math.max(0, Math.min(100, (progressMs / durationMs) * 100)) : 0;
  const canStartLiveStreamNow =
    enableStreaming &&
    linkedPartyId !== null &&
    publishingBridgeReady &&
    canStartAimpLiveStream(bridgeState);
  const degraded = isAimpDegraded(bridgeState);
  const connectionLabel =
    STATUS_LABELS[bridgeState.connection.phase] ?? bridgeState.connection.phase;
  const publishPathLabel = PUBLISHING_STATUS_LABELS[publishingPath.status] ?? publishingPath.status;
  const pluginVersionLabel = bridgeState.pluginMetadata?.pluginVersion
    ? `Plugin v${bridgeState.pluginMetadata.pluginVersion}`
    : 'Plugin version unavailable';
  const playlistNameLabel = bridgeState.playlistSnapshot?.playlistName ?? 'No snapshot yet';

  const startActionMessages = useMemo(() => {
    if (bridgeState.liveStreamStarted) {
      return [];
    }

    const messages: string[] = [];
    if (!enableStreaming) {
      messages.push('Сначала включите онлайн в настройках.');
    }
    if (!embedded && streamingSource !== 'aimp') {
      messages.push('Выберите AIMP как источник в зоне плеера.');
    }
    if (!availability.available) {
      availability.gatingReasons.forEach((reason) => messages.push(reason.message));
    }
    if (linkedPartyId === null) {
      messages.push('Для публикации нужна созданная или привязанная вечеринка.');
    }
    if (
      enableStreaming &&
      linkedPartyId !== null &&
      canStartAimpLiveStream(bridgeState) &&
      !publishingBridgeReady
    ) {
      if (publishingPath.status === 'connecting') {
        messages.push('Подождите, пока CherryPlay подготовит organizer publishing path для Party.');
      } else if (publishingPath.status === 'error' && publishingPath.error) {
        messages.push(publishingPath.error);
      }
    }
    if (bridgeState.connection.phase === 'listening') {
      messages.push('CherryPlayList слушает pipe, но AIMP плагин ещё не подключён.');
    }
    if (bridgeState.connection.phase === 'disconnected' && availability.available) {
      messages.push('Ожидается запуск AIMP плагина и handshake с приложением.');
    }
    if (bridgeState.connection.phase === 'stale') {
      messages.push(
        'Последние данные AIMP устарели. Дождитесь нового heartbeat или переподключения.',
      );
    }
    if (bridgeState.playlistSnapshot === null || bridgeState.playbackSnapshot === null) {
      messages.push('Для старта нужны актуальные playlist и playback snapshots от AIMP.');
    }

    return [...new Set(messages)];
  }, [
    availability.available,
    availability.gatingReasons,
    bridgeState,
    enableStreaming,
    linkedPartyId,
    publishingBridgeReady,
    publishingPath.error,
    publishingPath.status,
    streamingSource,
    embedded,
  ]);

  const handleToggleLiveStream = async () => {
    if (linkedPartyId === null) {
      return;
    }

    setIsSubmittingLiveStream(true);

    try {
      if (bridgeState.liveStreamStarted) {
        await setLiveStreamStarted(false);
      } else {
        if (!publishingBridgeReady) {
          throw new Error('AIMP publishing path is not ready yet.');
        }

        if (!canStartAimpLiveStream(bridgeState)) {
          throw new Error(
            'AIMP snapshots and plugin connection are not ready for live streaming yet.',
          );
        }

        await setLiveStreamStarted(true);
      }

      addNotification({
        type: 'success',
        message: bridgeState.liveStreamStarted
          ? 'Онлайн через AIMP остановлен'
          : 'Онлайн через AIMP запущен',
      });
    } catch (error) {
      addNotification({
        type: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Не удалось изменить состояние онлайна через AIMP',
        duration: 5000,
      });
    } finally {
      setIsSubmittingLiveStream(false);
    }
  };

  const liveStreamButtonLabel = isSubmittingLiveStream
    ? bridgeState.liveStreamStarted
      ? 'Остановка...'
      : 'Подготовка...'
    : bridgeState.liveStreamStarted
      ? 'Выключить онлайн'
      : 'Включить онлайн';

  return (
    <div
      className={embedded ? 'aimp-view aimp-view--embedded' : 'aimp-view'}
      style={{
        display: 'grid',
        gridTemplateRows: embedded
          ? 'auto auto minmax(0, 1fr) auto'
          : 'auto auto minmax(0, 1fr) auto',
        gap: 12,
        height: '100%',
        minHeight: 0,
      }}
    >
      {embedded ? (
        <div className="playlist-header-section player-header">
          <div className="playlist-header-toolbar">
            <div className="playlist-header-toolbar__primary">
              <div className="playlist-stats-header playlist-stats-header--inline">
                <div className="playlist-stats-header__info">
                  <ListIcon className="playlist-stats-header__icon" fontSize="inherit" />
                  <span>
                    {(bridgeState.playlistSnapshot?.trackCount ?? 0) === 0
                      ? 'Плейлист пуст'
                      : `${bridgeState.playlistSnapshot?.trackCount ?? 0} треков`}
                  </span>
                </div>
              </div>
            </div>
            <details style={{ position: 'relative', flexShrink: 0 }}>
              <summary
                style={{
                  listStyle: 'none',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-secondary)',
                }}
                title="Диагностика AIMP bridge"
                aria-label="Показать диагностику AIMP bridge"
              >
                <Icon size="md" shape="circle" aria-hidden>
                  i
                </Icon>
              </summary>
              <div
                className="app-card"
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 'calc(100% + 6px)',
                  zIndex: 10,
                  width: 'min(320px, calc(100vw - 24px))',
                  padding: 10,
                  borderRadius: 10,
                  display: 'grid',
                  gap: 4,
                  fontSize: '0.8rem',
                }}
              >
                <div style={{ fontWeight: 600 }}>{connectionLabel}</div>
                <div style={{ color: 'var(--text-secondary)' }}>
                  Listening: {bridgeState.connection.appListening ? 'yes' : 'no'}
                </div>
                <div style={{ color: 'var(--text-secondary)' }}>
                  Plugin: {bridgeState.connection.pluginConnected ? 'yes' : 'no'}
                </div>
                <div style={{ color: 'var(--text-secondary)' }}>Publish: {publishPathLabel}</div>
                <div style={{ color: 'var(--text-secondary)' }}>
                  Live: {bridgeState.liveStreamStarted ? 'yes' : 'no'}
                </div>
                <div style={{ color: 'var(--text-secondary)' }}>
                  Protocol: {bridgeState.protocolVersion}
                </div>
                <div style={{ color: 'var(--text-secondary)' }}>Playlist: {playlistNameLabel}</div>
                <div style={{ color: 'var(--text-secondary)' }}>{pluginVersionLabel}</div>
                {publishingPath.error && (
                  <div style={{ color: 'var(--color-danger, #ff8a80)' }}>
                    {publishingPath.error}
                  </div>
                )}
              </div>
            </details>
          </div>
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 8,
          }}
        >
          <div>
            <h2 className="panel-title">AIMP</h2>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: 4 }}>
              Мониторинг AIMP и онлайн для гостей.
            </div>
          </div>
          <details style={{ position: 'relative', flexShrink: 0 }}>
            <summary
              style={{
                listStyle: 'none',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-secondary)',
              }}
              title="Диагностика AIMP bridge"
              aria-label="Показать диагностику AIMP bridge"
            >
              <Icon size="md" shape="circle" aria-hidden>
                i
              </Icon>
            </summary>
            <div
              className="app-card"
              style={{
                position: 'absolute',
                right: 0,
                top: 'calc(100% + 6px)',
                zIndex: 10,
                width: 'min(320px, calc(100vw - 24px))',
                padding: 10,
                borderRadius: 10,
                display: 'grid',
                gap: 4,
                fontSize: '0.8rem',
              }}
            >
              <div style={{ fontWeight: 600 }}>{connectionLabel}</div>
              <div style={{ color: 'var(--text-secondary)' }}>
                Listening: {bridgeState.connection.appListening ? 'yes' : 'no'}
              </div>
              <div style={{ color: 'var(--text-secondary)' }}>
                Plugin: {bridgeState.connection.pluginConnected ? 'yes' : 'no'}
              </div>
              <div style={{ color: 'var(--text-secondary)' }}>Publish: {publishPathLabel}</div>
              <div style={{ color: 'var(--text-secondary)' }}>
                Live: {bridgeState.liveStreamStarted ? 'yes' : 'no'}
              </div>
              <div style={{ color: 'var(--text-secondary)' }}>
                Protocol: {bridgeState.protocolVersion}
              </div>
              <div style={{ color: 'var(--text-secondary)' }}>Playlist: {playlistNameLabel}</div>
              <div style={{ color: 'var(--text-secondary)' }}>{pluginVersionLabel}</div>
              {publishingPath.error && (
                <div style={{ color: 'var(--color-danger, #ff8a80)' }}>{publishingPath.error}</div>
              )}
            </div>
          </details>
        </div>
      )}

      <div style={{ minHeight: 0, display: 'grid', gridTemplateRows: 'auto auto minmax(0, 1fr)' }}>
        <div className="aimp-view__playlist-toolbar">
          <div className="aimp-view__playlist-toolbar-title">
            Playlist{' '}
            {bridgeState.playlistSnapshot ? `(${bridgeState.playlistSnapshot.trackCount})` : ''}
          </div>
          <Button
            type="button"
            className="modal-button"
            onClick={handleToggleLiveStream}
            disabled={
              isSubmittingLiveStream || (!bridgeState.liveStreamStarted && !canStartLiveStreamNow)
            }
            variant="primary"
            size="sm"
            data-party-header-guide-target="start-playback"
          >
            {liveStreamButtonLabel}
          </Button>
        </div>

        {(degraded || startActionMessages.length > 0) && (
          <div
            className={`aimp-view__playlist-banner ${
              degraded ? 'aimp-view__playlist-banner--degraded' : 'aimp-view__playlist-banner--info'
            }`}
          >
            {degraded && bridgeState.connection.disconnectReason?.message && (
              <div>{bridgeState.connection.disconnectReason.message}</div>
            )}
            {degraded && bridgeState.connection.protocolError?.message && (
              <div>{bridgeState.connection.protocolError.message}</div>
            )}
            {startActionMessages.map((message) => (
              <div key={message}>{message}</div>
            ))}
          </div>
        )}

        <ItemList
          className="playlist-tracks"
          showEmptyState
          emptyState={
            <EmptyState
              message="AIMP playlist is empty"
              hint="Подключите плагин и дождитесь snapshot с плейлистом"
            />
          }
        >
          {(bridgeState.playlistSnapshot?.tracks ?? []).map((track, index) => (
            <AimpPlaylistRow
              key={`${track.trackKey}-${index}`}
              track={track}
              index={index + 1}
              isActive={track.trackKey === currentTrack?.trackKey}
            />
          ))}
        </ItemList>
      </div>

      <div
        className="app-card"
        style={{
          padding: 12,
          borderRadius: 10,
          display: 'grid',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Current track</div>
            <div style={{ marginTop: 4, fontWeight: 600 }}>
              {currentTrack
                ? currentTrack.artist && currentTrack.artist.trim().length > 0
                  ? `${currentTrack.artist} - ${currentTrack.title}`
                  : currentTrack.title
                : durationMs > 0 || progressMs > 0
                  ? '—'
                  : 'No active track'}
            </div>
          </div>
          <div style={{ textAlign: 'right', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            {bridgeState.playbackSnapshot?.status ?? 'stopped'}
          </div>
        </div>

        <div
          style={{
            height: 6,
            borderRadius: 999,
            background: 'rgba(255,255,255,0.08)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${progressPercent}%`,
              height: '100%',
              background: 'var(--accent-primary, #ff4d6d)',
              transition: isProgressAdvancing ? 'width 0.8s linear' : 'none',
            }}
          />
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            color: 'var(--text-secondary)',
          }}
        >
          <span>{formatPlayerTime(progressMs / 1000)}</span>
          <span>{formatPlayerTime(durationMs / 1000)}</span>
        </div>
      </div>
    </div>
  );
};
