import React from 'react';

import { findTrack } from '../../core/utils/playlist';
import { formatTime } from '../../core/utils/time';
import { PartyThemeId } from '../../themes';
import { PlaybackState, PlayerItem } from '../../types';

import './CurrentTrackDisplay.css';

export interface CurrentTrackDisplayProps {
  playbackState: PlaybackState | null;
  playlist: { items: PlayerItem[] };
  className?: string;
  themeId?: PartyThemeId;
}

export const CurrentTrackDisplay: React.FC<CurrentTrackDisplayProps> = ({
  playbackState,
  playlist,
  className = '',
  themeId,
}) => {
  if (!playbackState || !playbackState.currentTrackId) {
    return null;
  }

  const currentTrack = findTrack(playlist.items, playbackState.currentTrackId);

  if (!currentTrack || currentTrack.type !== 'track') {
    return null;
  }

  const progress =
    playbackState.duration > 0 ? (playbackState.position / playbackState.duration) * 100 : 0;
  const duration = playbackState.duration > 0 ? playbackState.duration : currentTrack.duration;

  return (
    <div className={`party-current-track-display ${className}`} data-theme={themeId}>
      <div className="party-current-track-info">
        <div className="party-current-track-name">{currentTrack.name}</div>
        <div className="party-current-track-meta">
          <span className="party-current-track-status">{getStatusText(playbackState.status)}</span>
          <span className="party-current-track-time">
            {formatTime(playbackState.position)} /{' '}
            {duration != null && duration > 0 ? (
              formatTime(duration)
            ) : (
              <span
                className="party-current-track-time-loader"
                role="status"
                aria-label="Загрузка длительности"
              />
            )}
          </span>
        </div>
      </div>
      <div className="party-current-track-progress">
        <div className="party-current-track-progress-bar" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
};

const getStatusText = (status: PlaybackState['status']): string => {
  switch (status) {
    case 'playing':
      return '▶ Воспроизведение';
    case 'paused':
      return '⏸ Пауза';
    case 'ended':
      return '⏹ Завершено';
    default:
      return '⏹ Ожидание';
  }
};
