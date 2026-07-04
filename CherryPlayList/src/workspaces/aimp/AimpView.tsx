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

export const AimpView: React.FC<AimpViewProps> = () => {
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

  const startActionMessages = useMemo(() => {
    if (bridgeState.liveStreamStarted) {
      return [];
    }

    const messages: string[] = [];
    if (!enableStreaming) {
      messages.push('Сначала включите стриминг в общих настройках.');
    }
    if (streamingSource !== 'aimp') {
      messages.push('Выберите AIMP как источник стриминга.');
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
          ? 'AIMP стриминг для Party остановлен'
          : 'AIMP стриминг для Party запущен',
      });
    } catch (error) {
      addNotification({
        type: 'error',
        message:
          error instanceof Error ? error.message : 'Не удалось изменить состояние AIMP стриминга',
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
      ? 'Остановить стриминг'
      : 'Начать стриминг';

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateRows: 'auto auto minmax(0, 1fr) auto',
        gap: 12,
        height: '100%',
        minHeight: 0,
      }}
    >
      <div>
        <h2 className="panel-title">AIMP</h2>
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: 4 }}>
          Read-only bridge workspace for external playback state.
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: 8,
        }}
      >
        <div className="app-card" style={{ padding: 12, borderRadius: 10 }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Connection</div>
          <div style={{ fontSize: '1rem', fontWeight: 600, marginTop: 4 }}>
            {STATUS_LABELS[bridgeState.connection.phase] ?? bridgeState.connection.phase}
          </div>
          <div style={{ marginTop: 8, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            App listening: {bridgeState.connection.appListening ? 'yes' : 'no'}
          </div>
          <div style={{ marginTop: 4, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Plugin connected: {bridgeState.connection.pluginConnected ? 'yes' : 'no'}
          </div>
          <div style={{ marginTop: 4, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Publish path: {PUBLISHING_STATUS_LABELS[publishingPath.status] ?? publishingPath.status}
          </div>
          <div style={{ marginTop: 4, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Live stream started: {bridgeState.liveStreamStarted ? 'yes' : 'no'}
          </div>
          {publishingPath.error && (
            <div
              style={{
                marginTop: 8,
                fontSize: '0.85rem',
                color: 'var(--color-danger, #ff8a80)',
              }}
            >
              {publishingPath.error}
            </div>
          )}
        </div>

        <div className="app-card" style={{ padding: 12, borderRadius: 10 }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Bridge metadata</div>
          <div style={{ marginTop: 4, fontSize: '0.95rem', fontWeight: 600 }}>
            {bridgeState.pluginMetadata?.pluginVersion
              ? `Plugin v${bridgeState.pluginMetadata.pluginVersion}`
              : 'Plugin version unavailable'}
          </div>
          <div style={{ marginTop: 8, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Protocol: {bridgeState.protocolVersion}
          </div>
          <div style={{ marginTop: 4, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Playlist: {bridgeState.playlistSnapshot?.playlistName ?? 'No snapshot yet'}
          </div>
        </div>
      </div>

      <div style={{ minHeight: 0, display: 'grid', gridTemplateRows: 'auto auto minmax(0, 1fr)' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: 8,
          }}
        >
          <div style={{ fontWeight: 600 }}>
            Playlist{' '}
            {bridgeState.playlistSnapshot ? `(${bridgeState.playlistSnapshot.trackCount})` : ''}
          </div>
          <button
            type="button"
            className="modal-button primary"
            onClick={handleToggleLiveStream}
            disabled={
              isSubmittingLiveStream || (!bridgeState.liveStreamStarted && !canStartLiveStreamNow)
            }
          >
            {liveStreamButtonLabel}
          </button>
        </div>

        {(degraded || startActionMessages.length > 0) && (
          <div
            style={{
              marginBottom: 8,
              padding: 10,
              borderRadius: 8,
              background: degraded ? 'rgba(255, 152, 0, 0.12)' : 'rgba(255, 255, 255, 0.04)',
              border: degraded
                ? '1px solid rgba(255, 152, 0, 0.35)'
                : '1px solid rgba(255, 255, 255, 0.08)',
              display: 'grid',
              gap: 4,
              fontSize: '0.85rem',
            }}
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
