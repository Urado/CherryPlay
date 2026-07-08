import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import VolumeDownIcon from '@mui/icons-material/VolumeDown';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import React, { useCallback, useMemo } from 'react';
import { shallow } from 'zustand/shallow';

import { useCherryPlayStreamingConnection } from '@app/components/CherryPlayStreamingController';
import { getPlaybackPillReadinessHints } from '@app/components/playbackPillReadiness';
import { LAYOUT_PRESET_DISPLAY_NAMES_RU } from '@core/constants/layoutPresetDisplayNames';
import { isProjectTrack } from '@core/types/project';
import { StreamingConnectionIndicator } from '@shared/components';
import { signalRService } from '@shared/services';
import { usePlayerAudioStore, useProjectStore, useSettingsStore } from '@shared/stores';
import { formatPlayerTime } from '@shared/utils/durationUtils';
import { usePartyWorkspaceStore } from '@workspaces/party/partyWorkspaceStore';

interface HeaderPlaybackPillProps {
  disabled?: boolean;
}

const PREP_SETUP_HINT = `Для настройки вечеринки переключитесь на рабочее пространство «${LAYOUT_PRESET_DISPLAY_NAMES_RU.party}» или откройте зону «Настройка вечеринки».`;

export const HeaderPlaybackPill: React.FC<HeaderPlaybackPillProps> = ({ disabled = false }) => {
  const enableStreaming = useSettingsStore((state) => state.enableStreaming);
  const streamingSource = useSettingsStore((state) => state.streamingSource);
  const linkedParty = useProjectStore((state) => state.meta?.linkedParty ?? null);
  const sessionMode = useProjectStore((state) => state.sessionState.mode);
  const sessionCurrentTrackId = useProjectStore((state) => state.sessionState.currentTrackId);
  const partyLifecycleState = usePartyWorkspaceStore((state) => state.partyLifecycleState);

  const { connectionState, reconnect } = useCherryPlayStreamingConnection();

  const { currentTrack, status, position, duration, volume, error, play, pause, setVolume } =
    usePlayerAudioStore(
      (state) => ({
        currentTrack: state.currentTrack,
        status: state.status,
        position: state.position,
        duration: state.duration,
        volume: state.volume,
        error: state.error,
        play: state.play,
        pause: state.pause,
        setVolume: state.setVolume,
      }),
      shallow,
    );

  const resolveTrackById = useProjectStore((state) => state.findItemById);

  const isSessionMode = sessionMode === 'session';

  const trackLabel = useMemo(() => {
    if (currentTrack?.name) {
      return currentTrack.name;
    }
    if (sessionCurrentTrackId) {
      const item = resolveTrackById(sessionCurrentTrackId);
      if (item && isProjectTrack(item)) {
        return item.name;
      }
    }
    return '—';
  }, [currentTrack?.name, resolveTrackById, sessionCurrentTrackId]);

  const readinessHints = useMemo(() => {
    return getPlaybackPillReadinessHints({
      linkedParty,
      partyLifecycleState,
      isSessionMode,
      connectionState: linkedParty ? connectionState : null,
      connectionErrorReason: signalRService.getConnectionErrorReason(),
      playerError: error,
    });
  }, [linkedParty, partyLifecycleState, isSessionMode, connectionState, error]);

  const readinessTooltip = readinessHints.join('\n\n');

  const isVisible = enableStreaming && streamingSource === 'cherryPlayPlayer';

  const isPlaying = status === 'playing';
  const canToggle = currentTrack !== null && !disabled;
  const resolvedDuration = duration || currentTrack?.duration || 0;
  const showTimeline = resolvedDuration > 0 && currentTrack !== null;

  const handleToggle = useCallback(async () => {
    if (!canToggle) {
      return;
    }

    if (isPlaying) {
      pause();
    } else {
      try {
        await play();
      } catch {
        // store handles error state
      }
    }
  }, [canToggle, isPlaying, pause, play]);

  const handleVolumeChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setVolume(parseFloat(event.target.value));
    },
    [setVolume],
  );

  if (!isVisible) {
    return null;
  }

  const onlineIndicator = (
    <StreamingConnectionIndicator
      connectionState={linkedParty ? connectionState : null}
      onReconnect={reconnect}
      className="playback-pill__online"
      compact
    />
  );

  const readinessHintIcon =
    readinessHints.length > 0 ? (
      <span
        className="playback-pill__hint playback-pill__hint--active"
        title={readinessTooltip}
        role="img"
        aria-label={readinessTooltip}
      >
        <LightbulbOutlinedIcon className="playback-pill__hint-icon" aria-hidden />
      </span>
    ) : null;

  return (
    <div
      className={[
        'playback-pill',
        disabled ? 'playback-pill--blocked' : '',
        isSessionMode ? '' : 'playback-pill--prep',
      ]
        .filter(Boolean)
        .join(' ')}
      role="group"
      aria-label="Вечеринка и проигрывание"
    >
      {isSessionMode ? (
        <>
          <button
            type="button"
            className="playback-pill__toggle"
            onClick={() => {
              void handleToggle();
            }}
            disabled={!canToggle}
            title={error ? error : isPlaying ? 'Пауза' : canToggle ? 'Воспроизвести' : 'Нет трека'}
            aria-label={isPlaying ? 'Пауза' : 'Воспроизвести'}
          >
            {isPlaying ? <PauseIcon fontSize="small" /> : <PlayArrowIcon fontSize="small" />}
          </button>

          <div className="playback-pill__track" title={trackLabel}>
            <span className="playback-pill__track-name">{trackLabel}</span>
            {showTimeline ? (
              <span className="playback-pill__track-time">
                {formatPlayerTime(position)} / {formatPlayerTime(resolvedDuration)}
              </span>
            ) : null}
          </div>

          <div className="playback-pill__volume">
            <VolumeDownIcon fontSize="small" aria-hidden />
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={handleVolumeChange}
              className="playback-pill__volume-slider"
              disabled={disabled}
              title={`Громкость: ${Math.round(volume * 100)}%`}
              aria-label="Громкость"
            />
            <VolumeUpIcon fontSize="small" aria-hidden />
          </div>

          {readinessHintIcon}
          {onlineIndicator}
        </>
      ) : (
        <>
          <div className="playback-pill__prep-row">
            <span className="playback-pill__prep-label">Проигрывание не запущено</span>
            <span
              className="playback-pill__hint"
              title={PREP_SETUP_HINT}
              role="img"
              aria-label={PREP_SETUP_HINT}
            >
              <InfoOutlinedIcon className="playback-pill__hint-icon" aria-hidden />
            </span>
          </div>
          {readinessHintIcon}
          {onlineIndicator}
        </>
      )}
    </div>
  );
};
