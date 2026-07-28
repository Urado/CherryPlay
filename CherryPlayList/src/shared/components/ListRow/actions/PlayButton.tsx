import { PlaybackControlButton } from '@cherryplay/components';
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
  // isLocked still blocks drag/edit on played/current rows; demo play must stay clickable.
  const { baseClassName, isActive, isPlaying } = useListRowContext();

  const playing = isActive && isPlaying;

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (disabled) {
      return;
    }
    if (playing && onPause) {
      onPause();
    } else if (onPlay) {
      onPlay();
    }
  };

  return (
    <PlaybackControlButton
      control={playing ? 'pause' : 'play'}
      size="sm"
      onClick={handleClick}
      className={`${baseClassName}-play ${isActive ? 'active' : ''}`}
      disabled={disabled}
      title={disabled ? disabledTitle : undefined}
      aria-label={playing ? 'Pause' : 'Play'}
    />
  );
};

PlayButton.displayName = 'ListRow.PlayButton';
