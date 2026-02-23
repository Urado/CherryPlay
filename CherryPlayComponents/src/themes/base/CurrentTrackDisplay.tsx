import React from 'react';

import { findTrack } from '../../core/utils/playlist';
import { formatTime } from '../../core/utils/time';
import { PlaybackState, PlayerItem, PartyPlaylistData } from '../../types';

import '../../components/Player/CurrentTrackDisplay.css';

export interface BaseCurrentTrackDisplayProps {
  playbackState: PlaybackState | null;
  playlist: PartyPlaylistData | { items: PlayerItem[] };
  className?: string;
  themeId?: string;
}

export const CurrentTrackDisplay: React.FC<BaseCurrentTrackDisplayProps> = ({
  playbackState,
  playlist,
  className = '',
  themeId,
}) => {
  if (!playbackState || !playbackState.currentTrackId) {
    return null;
  }

  const playlistItems = playlist.items;
  const currentTrack = findTrack(playlistItems, playbackState.currentTrackId);

  if (!currentTrack || currentTrack.type !== 'track') {
    return null;
  }

  const progress =
    playbackState.duration > 0 ? (playbackState.position / playbackState.duration) * 100 : 0;

  return (
    <div className={`party-current-track-display ${className}`} data-theme={themeId}>
      <div className="party-current-track-info">
        <div className="party-current-track-name">{currentTrack.name}</div>
        <div className="party-current-track-meta">
          <span className="party-current-track-status">{getStatusText(playbackState.status)}</span>
          <span className="party-current-track-time">
            {formatTime(playbackState.position)} / {formatTime(playbackState.duration)}
          </span>
        </div>
      </div>
      <div className="party-current-track-progress">
        <div className="party-current-track-progress-bar" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
};

function getStatusText(status: PlaybackState['status']): string {
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
}
