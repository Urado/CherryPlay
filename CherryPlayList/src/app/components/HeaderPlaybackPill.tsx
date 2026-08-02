import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import VolumeDownIcon from '@mui/icons-material/VolumeDown';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import React, { useCallback, useMemo } from 'react';
import { shallow } from 'zustand/shallow';

import { useCherryPlayStreamingConnection } from '@app/components/CherryPlayStreamingController';
import { isProjectTrack } from '@core/types/project';
import { StreamingConnectionIndicator } from '@shared/components';
import { usePlayerAudioStore, useProjectStore, useSettingsStore } from '@shared/stores';
import { formatPlayerTime } from '@shared/utils/durationUtils';

interface HeaderPlaybackPillProps {
  disabled?: boolean;
}

export const HeaderPlaybackPill: React.FC<HeaderPlaybackPillProps> = ({ disabled = false }) => {
  const streamingSource = useSettingsStore((state) => state.streamingSource);
  const linkedParty = useProjectStore((state) => state.meta?.linkedParty ?? null);
  const sessionMode = useProjectStore((state) => state.sessionState.mode);
  const sessionCurrentTrackId = useProjectStore((state) => state.sessionState.currentTrackId);

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

  const isVisible = sessionMode === 'session' && streamingSource === 'cherryPlayPlayer';

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
      } catch (playError: unknown) {
        void playError;
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

  return (
    <div
      className={['playback-pill', disabled ? 'playback-pill--blocked' : '']
        .filter(Boolean)
        .join(' ')}
      role="group"
      aria-label="Вечеринка и проигрывание"
    >
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
        <span className="playback-pill__icon-box" aria-hidden>
          {isPlaying ? <PauseIcon fontSize="inherit" /> : <PlayArrowIcon fontSize="inherit" />}
        </span>
      </button>

      <div className="playback-pill__main">
        <div className="playback-pill__track" title={trackLabel}>
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

      <div className="playback-pill__volume">
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
          disabled={disabled}
          title={`Громкость: ${Math.round(volume * 100)}%`}
          aria-label="Громкость"
        />
        <span className="playback-pill__icon-box playback-pill__icon-box--sm" aria-hidden>
          <VolumeUpIcon fontSize="inherit" />
        </span>
      </div>

      <StreamingConnectionIndicator
        connectionState={linkedParty ? connectionState : null}
        onReconnect={reconnect}
        className="playback-pill__online"
        compact
      />
    </div>
  );
};
