import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import React from 'react';

import { useListRowContext } from '../ListRowContext';

/**
 * Props for PlayButton component
 */
export interface PlayButtonProps {
  /** Called when play is clicked */
  onPlay?: () => void;
  /** Called when pause is clicked */
  onPause?: () => void;
  /** When true, play is disabled (e.g. missing file on disk) */
  disabled?: boolean;
  /** Tooltip when disabled */
  disabledTitle?: string;
}

/**
 * PlayButton - Play/Pause button for audio items
 *
 * Automatically switches between play and pause icons based on context state.
 */
export const PlayButton: React.FC<PlayButtonProps> = ({
  onPlay,
  onPause,
  disabled = false,
  disabledTitle,
}) => {
  const { baseClassName, isActive, isPlaying } = useListRowContext();

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) {
      return;
    }
    if (isActive && isPlaying && onPause) {
      onPause();
    } else if (onPlay) {
      onPlay();
    }
  };

  return (
    <button
      type="button"
      className={`${baseClassName}-play ${isActive ? 'active' : ''}`}
      onClick={handleClick}
      disabled={disabled}
      title={disabled ? disabledTitle : undefined}
      aria-label={isActive && isPlaying ? 'Pause' : 'Play'}
    >
      {isActive && isPlaying ? <PauseIcon fontSize="small" /> : <PlayArrowIcon fontSize="small" />}
    </button>
  );
};

PlayButton.displayName = 'ListRow.PlayButton';
