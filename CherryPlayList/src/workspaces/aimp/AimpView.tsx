import { Button } from '@cherryplay/components';
import { WorkspaceId } from '@core/types/workspace';
import ListIcon from '@mui/icons-material/List';
import { EmptyState, ItemList, ListRowCompound } from '@shared/components';
import { type AimpDisconnectReason, type AimpPlaylistTrackDto } from '@shared/contracts/aimp';
import { isDemoFixturesMode, isDemoLiveMode } from '@shared/platform/demoLiveMode';
import type { DemoAimpPlaylistSize } from '@shared/platform/types';
import { aimpService } from '@shared/services/aimpService';
import {
  useAimpStore,
  useAuthStore,
  useProjectStore,
  useSettingsStore,
  useUIStore,
} from '@shared/stores';
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
import React, { useEffect, useMemo, useState } from 'react';

import { resolveAimpServerConnectionStatus } from './resolveAimpServerConnectionStatus';
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

const DEMO_PLAYLIST_SIZE_OPTIONS: Array<{
  size: DemoAimpPlaylistSize;
  count: number;
  label: string;
}> = [
  { size: 'small', count: 3, label: '3 трека' },
  { size: 'medium', count: 25, label: '25 треков' },
  { size: 'large', count: 100, label: '100 треков' },
];
const DISCONNECT_NOTICE_DURATION_MS = 30000;

const getAimpDisconnectMessage = (reason: AimpDisconnectReason | null): string | null => {
  if (!reason) {
    return null;
  }

  if (reason.code === 'clientGoodbye') {
    if (reason.detail?.includes('reason=appClosing')) {
      return 'AIMP завершил работу. Запустите его снова, чтобы восстановить подключение.';
    }
    if (reason.detail?.includes('reason=pluginShutdown')) {
      return 'Плагин AIMP отключился. Проверьте, что плеер работает и плагин включён.';
    }
    return 'Плагин AIMP отключился. Проверьте, что плеер работает и плагин подключён.';
  }

  if (reason.code === 'heartbeatTimeout') {
    return 'Давно не получали данные от AIMP. Проверьте, что плеер работает и плагин подключён.';
  }

  if (reason.code === 'protocolVersionMismatch') {
    return 'Версия плагина AIMP не подходит к приложению. Обновите плагин.';
  }

  if (reason.code === 'malformedPayload') {
    return 'Не удалось прочитать данные плагина AIMP. Проверьте, что установлена актуальная версия плагина.';
  }

  return 'Соединение с AIMP прервано. Проверьте, что плеер работает и плагин подключён.';
};

const getAimpProtocolErrorMessage = (hasError: boolean): string | null =>
  hasError
    ? 'Не удалось обменяться данными с плагином AIMP. Проверьте его подключение и версию.'
    : null;

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

const useProgressClock = (isActive: boolean): number => {
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
};

export const AimpView: React.FC<AimpViewProps> = ({ embedded = false }) => {
  const bridgeState = useAimpStore((state) => state.bridgeState);
  const publishingBridgeReady = useAimpStore((state) => state.publishingBridgeReady);
  const publishingPath = useAimpStore((state) => state.publishingPath);
  const setLiveStreamStarted = useAimpStore((state) => state.setLiveStreamStarted);
  const setBridgeState = useAimpStore((state) => state.setBridgeState);
  const enableStreaming = useSettingsStore((state) => state.enableStreaming);
  const streamingSource = useSettingsStore((state) => state.streamingSource);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated());
  const linkedPartyId = useProjectStore((state) => state.meta.linkedParty?.id ?? null);
  const addNotification = useUIStore((state) => state.addNotification);
  const [isSubmittingLiveStream, setIsSubmittingLiveStream] = useState(false);
  const [isChangingDemoPlaylistSize, setIsChangingDemoPlaylistSize] = useState(false);
  const [isDisconnectNoticeExpired, setIsDisconnectNoticeExpired] = useState(false);
  const disconnectOccurredAt = bridgeState.connection.disconnectReason?.occurredAt ?? null;
  const isDemoMode = isDemoFixturesMode() || isDemoLiveMode();
  const playlistTrackCount = bridgeState.playlistSnapshot?.trackCount ?? 0;
  const playlistSize =
    DEMO_PLAYLIST_SIZE_OPTIONS.find((option) => option.count === playlistTrackCount)?.size ??
    'small';

  const handleDemoPlaylistSizeChange = async (
    event: React.ChangeEvent<HTMLSelectElement>,
  ): Promise<void> => {
    setIsChangingDemoPlaylistSize(true);
    try {
      const nextState = await aimpService.setDemoPlaylistSize(
        event.currentTarget.value as DemoAimpPlaylistSize,
      );
      setBridgeState(nextState);
    } catch (error) {
      addNotification({
        type: 'error',
        message: error instanceof Error ? error.message : 'Не удалось изменить демо-плейлист AIMP',
      });
    } finally {
      setIsChangingDemoPlaylistSize(false);
    }
  };

  useEffect(() => {
    if (!disconnectOccurredAt) {
      setIsDisconnectNoticeExpired(false);
      return;
    }

    const occurredAtMs = Date.parse(disconnectOccurredAt);
    if (Number.isNaN(occurredAtMs)) {
      setIsDisconnectNoticeExpired(true);
      return;
    }

    const elapsedMs = Date.now() - occurredAtMs;
    const remainingMs = DISCONNECT_NOTICE_DURATION_MS - elapsedMs;
    if (remainingMs <= 0) {
      setIsDisconnectNoticeExpired(true);
      return;
    }

    setIsDisconnectNoticeExpired(false);
    const timeoutId = window.setTimeout(() => setIsDisconnectNoticeExpired(true), remainingMs);

    return () => window.clearTimeout(timeoutId);
  }, [disconnectOccurredAt]);

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
  const disconnectReasonMessage = isDisconnectNoticeExpired
    ? null
    : getAimpDisconnectMessage(bridgeState.connection.disconnectReason);
  const protocolErrorMessage = getAimpProtocolErrorMessage(
    bridgeState.connection.protocolError !== null,
  );
  const aimpConnectionStatus =
    bridgeState.connection.phase === 'connected'
      ? { name: 'AIMP', label: 'Подключён', state: 'connected' }
      : bridgeState.connection.phase === 'listening'
        ? { name: 'AIMP', label: 'Ожидаем подключения', state: 'connecting' }
        : bridgeState.connection.phase === 'stale'
          ? { name: 'AIMP', label: 'Нет свежих данных', state: 'connecting' }
          : { name: 'AIMP', label: 'Отключён', state: 'disconnected' };
  const serverConnectionStatus = resolveAimpServerConnectionStatus({
    isAuthenticated,
    enableStreaming,
    linkedPartyId,
    publishingPathStatus: publishingPath.status,
  });
  const connectionIndicators = (
    <div
      aria-label="Состояние подключений"
      style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}
    >
      {[aimpConnectionStatus, serverConnectionStatus].map((status) => (
        <span
          key={status.name}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}
          role="status"
          title={`${status.name}: ${status.label}`}
          aria-label={`${status.name}: ${status.label}`}
        >
          <span
            className="streaming-connection-indicator__label"
            style={{ textAlign: 'right', fontSize: 9, lineHeight: 1, cursor: 'help' }}
            title={`${status.name}: ${status.label}`}
          >
            {status.name}
          </span>
          <span
            className={`streaming-connection-indicator__dot streaming-connection-indicator__dot--${status.state}`}
            aria-hidden="true"
            style={{ width: 9, height: 9 }}
          />
        </span>
      ))}
    </div>
  );

  const startActionMessages = useMemo(() => {
    if (bridgeState.liveStreamStarted) {
      if (bridgeState.connection.phase === 'connected') {
        return [];
      }
      return [
        protocolErrorMessage ??
          disconnectReasonMessage ??
          'Нет связи с AIMP. Проверьте плеер и плагин, чтобы обновить трансляцию.',
      ];
    }

    if (!availability.available) {
      return availability.gatingReasons.map((reason) => reason.message);
    }

    if (bridgeState.connection.phase !== 'connected') {
      if (protocolErrorMessage) {
        return [protocolErrorMessage];
      }
      if (disconnectReasonMessage) {
        return [disconnectReasonMessage];
      }
      if (bridgeState.connection.phase === 'listening') {
        return ['Ожидаем подключение AIMP. Убедитесь, что плеер запущен и плагин установлен.'];
      }
      if (bridgeState.connection.phase === 'stale') {
        return ['Нет свежих данных от AIMP. Проверьте, что плеер работает и плагин подключён.'];
      }
      return ['AIMP не подключён. Запустите плеер и проверьте подключение плагина.'];
    }

    const messages: string[] = [];
    if (!enableStreaming) {
      messages.push('Включите «Онлайн» в настройках, чтобы начать трансляцию.');
    }
    if (!embedded && streamingSource !== 'aimp') {
      messages.push('Выберите AIMP в качестве источника проигрывания.');
    }
    if (bridgeState.playlistSnapshot === null || bridgeState.playbackSnapshot === null) {
      messages.push('Подключение есть. Ожидаем плейлист и данные о текущем треке из AIMP.');
    } else if (linkedPartyId === null) {
      messages.push(
        'Создайте вечеринку или привяжите существующую, чтобы показывать музыку гостям.',
      );
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
    disconnectReasonMessage,
    protocolErrorMessage,
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
  const isLiveStreamButtonDisabled =
    isSubmittingLiveStream || (!bridgeState.liveStreamStarted && !canStartLiveStreamNow);
  const liveStreamButtonDisabledReason = isSubmittingLiveStream
    ? 'Подождите, пока завершится изменение состояния онлайна.'
    : !bridgeState.liveStreamStarted && !canStartLiveStreamNow
      ? startActionMessages.join(' ') ||
        'Проверьте подключение AIMP, привязку вечеринки и готовность сервера.'
      : undefined;

  return (
    <div
      className={embedded ? 'aimp-view aimp-view--embedded' : 'aimp-view'}
      style={{
        display: 'grid',
        gridTemplateRows: 'auto minmax(0, 1fr) auto',
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
            {connectionIndicators}
          </div>
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div>
            <h2 className="panel-title">AIMP</h2>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: 4 }}>
              Мониторинг AIMP и онлайн для гостей.
            </div>
          </div>
          {connectionIndicators}
        </div>
      )}

      <div style={{ minHeight: 0, display: 'grid', gridTemplateRows: 'auto auto minmax(0, 1fr)' }}>
        <div className="aimp-view__playlist-toolbar">
          <div className="aimp-view__playlist-toolbar-title">
            Playlist{' '}
            {bridgeState.playlistSnapshot ? `(${bridgeState.playlistSnapshot.trackCount})` : ''}
          </div>
          {isDemoMode && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
              <span>Демо</span>
              <select
                aria-label="Размер демо-плейлиста"
                value={playlistSize}
                onChange={(event) => {
                  void handleDemoPlaylistSizeChange(event);
                }}
                disabled={isChangingDemoPlaylistSize}
              >
                {DEMO_PLAYLIST_SIZE_OPTIONS.map((option) => (
                  <option key={option.size} value={option.size}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          <span title={liveStreamButtonDisabledReason} style={{ display: 'inline-flex' }}>
            <Button
              type="button"
              className="modal-button"
              onClick={() => {
                void handleToggleLiveStream();
              }}
              disabled={isLiveStreamButtonDisabled}
              variant="primary"
              size="sm"
              data-party-header-guide-target={
                bridgeState.liveStreamStarted ? 'stop-playback' : 'start-playback'
              }
            >
              {liveStreamButtonLabel}
            </Button>
          </span>
        </div>

        {(startActionMessages.length > 0 || (degraded && protocolErrorMessage !== null)) && (
          <div
            className={`aimp-view__playlist-banner ${
              degraded ? 'aimp-view__playlist-banner--degraded' : 'aimp-view__playlist-banner--info'
            }`}
          >
            {degraded && bridgeState.connection.phase === 'connected' && protocolErrorMessage && (
              <div>{protocolErrorMessage}</div>
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
              index={index}
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
          alignSelf: 'end',
          height: 'fit-content',
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
