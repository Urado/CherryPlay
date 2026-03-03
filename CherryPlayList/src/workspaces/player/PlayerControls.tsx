import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import StopIcon from '@mui/icons-material/Stop';
import VolumeDownIcon from '@mui/icons-material/VolumeDown';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import React, { useCallback } from 'react';

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
  const safePosition = isDisabled ? 0 : position;
  const resolvedDuration = duration || currentTrack?.duration || 0;
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

  const handleSeek = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (isDisabled) {
        return;
      }
      const newPosition = parseFloat(e.target.value);
      seek(newPosition);
    },
    [isDisabled, seek],
  );

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
        <button
          type="button"
          className={`player-controls__button player-controls__button--play${hasError ? ' player-controls__button--error' : ''}`}
          onClick={handleToggle}
          disabled={isDisabled}
          title={
            hasError ? (error ?? 'Ошибка воспроизведения') : isPlaying ? 'Пауза' : 'Воспроизвести'
          }
          style={hasError ? { color: 'var(--color-error, #f44336)' } : undefined}
        >
          {hasError ? (
            <ErrorOutlineIcon fontSize="medium" />
          ) : isPlaying ? (
            <PauseIcon fontSize="medium" />
          ) : (
            <PlayArrowIcon fontSize="medium" />
          )}
        </button>
        <button
          type="button"
          className="player-controls__button player-controls__button--stop"
          onClick={handleStop}
          disabled={isDisabled}
          title="Остановить"
        >
          <StopIcon fontSize="medium" />
        </button>
        <button
          type="button"
          className="player-controls__button player-controls__button--next"
          onClick={handleNext}
          disabled={isNextDisabled}
          title="Следующий"
        >
          <SkipNextIcon fontSize="medium" />
        </button>
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
        <span className="player-controls__time">{formatPlayerTime(safePosition)}</span>
        <input
          type="range"
          min={0}
          max={resolvedDuration || 1}
          step={0.1}
          value={safePosition}
          onChange={handleSeek}
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
