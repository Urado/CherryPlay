import { PlaybackControlButton } from '@cherryplay/components';
import VolumeDownIcon from '@mui/icons-material/VolumeDown';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import React, { useCallback } from 'react';

import { usePlaybackTimeline } from '@shared/hooks/usePlaybackTimeline';
import { usePlayerAudioStore, useProjectStore } from '@shared/stores';
import { formatPlayerTime } from '@shared/utils/durationUtils';

interface PlayerControlsProps {
  onNext?: () => void;
}

export const PlayerControls: React.FC<PlayerControlsProps> = ({ onNext }) => {
  const mode = useProjectStore((state) => state.sessionState.mode);
  const isSessionMode = mode === 'session';
  const sessionCurrentTrackId = useProjectStore((state) => state.sessionState.currentTrackId);

  const {
    currentTrack,
    status,
    position,
    duration,
    volume,
    error,
    play,
    pause,
    stop,
    seek,
    setVolume,
  } = usePlayerAudioStore();

  const isPlaying = status === 'playing';
  const isDisabled = !isSessionMode || !currentTrack;
  const isNextDisabled = !isSessionMode || !onNext;
  const resolvedDuration = duration || currentTrack?.duration || 0;
  const timeline = usePlaybackTimeline({
    position: isDisabled ? 0 : position,
    duration: resolvedDuration,
    disabled: isDisabled,
    seek,
  });
  // Show error if there's a loaded track OR if we're in session mode with an expected track
  // (handles the case where loadTrack fails before currentTrack is set in the audio store)
  const hasError =
    error !== null && (currentTrack !== null || (isSessionMode && sessionCurrentTrackId !== null));

  const handleToggle = useCallback(async () => {
    if (isDisabled) {
      return;
    }

    if (isPlaying) {
      pause();
    } else {
      try {
        await play();
      } catch {
        // Ошибка уже обработана в store
      }
    }
  }, [isDisabled, isPlaying, play, pause]);

  const handleStop = useCallback(() => {
    if (isDisabled) {
      return;
    }
    stop();
  }, [isDisabled, stop]);

  const handleNext = useCallback(() => {
    if (isNextDisabled || !onNext) {
      return;
    }
    onNext();
  }, [isNextDisabled, onNext]);

  const handleVolumeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newVolume = parseFloat(e.target.value);
      setVolume(newVolume);
    },
    [setVolume],
  );

  return (
    <div className="player-controls">
      <div className="player-controls__buttons">
        <PlaybackControlButton
          control={hasError ? 'error' : isPlaying ? 'pause' : 'play'}
          size="md"
          onClick={handleToggle}
          disabled={isDisabled}
          title={
            hasError ? (error ?? 'Ошибка воспроизведения') : isPlaying ? 'Пауза' : 'Воспроизвести'
          }
        />
        <PlaybackControlButton
          control="stop"
          size="md"
          onClick={handleStop}
          disabled={isDisabled}
          title="Начать заново"
          aria-label="Начать заново"
        />
        <PlaybackControlButton
          control="next"
          size="md"
          onClick={handleNext}
          disabled={isNextDisabled}
          title="Следующий"
          aria-label="Следующий"
        />
        <div className="player-controls__volume">
          <VolumeDownIcon fontSize="small" />
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={handleVolumeChange}
            className="player-controls__volume-slider"
            title={`Громкость: ${Math.round(volume * 100)}%`}
          />
          <VolumeUpIcon fontSize="small" />
          <span className="player-controls__volume-value">{Math.round(volume * 100)}%</span>
        </div>
      </div>

      <div className="player-controls__info">
        <div className="player-controls__track-name">
          {currentTrack?.name ?? 'Нет активного трека'}
        </div>
        {error && <div className="player-controls__error">{error}</div>}
      </div>

      <div className="player-controls__timeline-row">
        <span className="player-controls__time">{formatPlayerTime(timeline.displayPosition)}</span>
        <input
          type="range"
          min={0}
          max={timeline.resolvedDuration}
          step={0.1}
          value={timeline.displayPosition}
          onPointerDown={timeline.beginScrub}
          onInput={timeline.handleInput}
          onChange={timeline.handleChange}
          disabled={isDisabled}
          className="player-controls__timeline"
        />
        <span className="player-controls__time player-controls__time--total">
          {formatPlayerTime(resolvedDuration)}
        </span>
      </div>
    </div>
  );
};
