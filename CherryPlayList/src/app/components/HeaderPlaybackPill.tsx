import { Icon } from '@cherryplay/components';
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
    if (!isSessionMode || !canToggle) {
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
  }, [canToggle, isPlaying, isSessionMode, pause, play]);

  const handleVolumeChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setVolume(parseFloat(event.target.value));
    },
    [setVolume],
  );

  // Keep layout slot when hidden (e.g. AIMP streaming source) so the header does not jump.
  if (!isVisible) {
    return <div className="playback-pill playback-pill--slot-reserved" aria-hidden="true" />;
  }

  const hasReadinessHint = readinessHints.length > 0;
  const showPrepInfoHint = !isSessionMode && !hasReadinessHint;
  const hintTooltip = hasReadinessHint
    ? readinessTooltip
    : showPrepInfoHint
      ? PREP_SETUP_HINT
      : undefined;
  const hintActive = hasReadinessHint || showPrepInfoHint;

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
      <button
        type="button"
        className={['playback-pill__toggle', !isSessionMode ? 'playback-pill__slot--inert' : '']
          .filter(Boolean)
          .join(' ')}
        onClick={() => {
          void handleToggle();
        }}
        disabled={!isSessionMode || !canToggle}
        tabIndex={isSessionMode ? undefined : -1}
        aria-hidden={!isSessionMode}
        title={
          !isSessionMode
            ? undefined
            : error
              ? error
              : isPlaying
                ? 'Пауза'
                : canToggle
                  ? 'Воспроизвести'
                  : 'Нет трека'
        }
        aria-label={isSessionMode ? (isPlaying ? 'Пауза' : 'Воспроизвести') : undefined}
      >
        <span className="playback-pill__icon-box" aria-hidden>
          {isPlaying ? <PauseIcon fontSize="inherit" /> : <PlayArrowIcon fontSize="inherit" />}
        </span>
      </button>

      <div className="playback-pill__main">
        <div
          className={[
            'playback-pill__prep-row',
            isSessionMode ? 'playback-pill__layer--hidden' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          aria-hidden={isSessionMode}
        >
          <span className="playback-pill__prep-label">Проигрывание не запущено</span>
        </div>

        <div
          className={['playback-pill__track', !isSessionMode ? 'playback-pill__layer--hidden' : '']
            .filter(Boolean)
            .join(' ')}
          title={isSessionMode ? trackLabel : undefined}
          aria-hidden={!isSessionMode}
        >
          <span className="playback-pill__track-name">{trackLabel}</span>
          <span
            className={[
              'playback-pill__track-time',
              showTimeline ? '' : 'playback-pill__track-time--placeholder',
            ]
              .filter(Boolean)
              .join(' ')}
            aria-hidden={!showTimeline}
          >
            {showTimeline
              ? `${formatPlayerTime(position)} / ${formatPlayerTime(resolvedDuration)}`
              : '\u00a0'}
          </span>
        </div>
      </div>

      <div
        className={['playback-pill__volume', !isSessionMode ? 'playback-pill__slot--inert' : '']
          .filter(Boolean)
          .join(' ')}
        aria-hidden={!isSessionMode}
      >
        <span className="playback-pill__icon-box playback-pill__icon-box--sm" aria-hidden>
          <VolumeDownIcon fontSize="inherit" />
        </span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={handleVolumeChange}
          className="playback-pill__volume-slider"
          disabled={disabled || !isSessionMode}
          tabIndex={isSessionMode ? undefined : -1}
          title={`Громкость: ${Math.round(volume * 100)}%`}
          aria-label="Громкость"
        />
        <span className="playback-pill__icon-box playback-pill__icon-box--sm" aria-hidden>
          <VolumeUpIcon fontSize="inherit" />
        </span>
      </div>

      <span
        className={[
          'playback-pill__hint',
          hasReadinessHint ? 'playback-pill__hint--active' : '',
          !hintActive ? 'playback-pill__hint--empty' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        title={hintTooltip}
        role={hintActive ? 'img' : undefined}
        aria-label={hintTooltip}
        aria-hidden={hintActive ? undefined : true}
      >
        {hasReadinessHint ? (
          <Icon shape="circle" className="playback-pill__hint-glyph" aria-hidden>
            <LightbulbOutlinedIcon fontSize="inherit" />
          </Icon>
        ) : showPrepInfoHint ? (
          <Icon shape="circle" className="playback-pill__hint-glyph" aria-hidden>
            i
          </Icon>
        ) : null}
      </span>

      <StreamingConnectionIndicator
        connectionState={linkedParty ? connectionState : null}
        onReconnect={reconnect}
        className="playback-pill__online"
        compact
      />
    </div>
  );
};
