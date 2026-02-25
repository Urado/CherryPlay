import React from 'react';

import { findTrack } from '../../core/utils/playlist';
import { formatTime } from '../../core/utils/time';
import { PlaybackState, PlayerItem, PartyPlaylistData } from '../../types';

import '../../components/Player/CurrentTrackDisplay.css';

export interface SpringCrossStepCurrentTrackDisplayProps {
  playbackState: PlaybackState | null;
  playlist: PartyPlaylistData | { items: PlayerItem[] };
  className?: string;
  themeId?: string;
}

function getStatusLabel(status: PlaybackState['status']): string {
  switch (status) {
    case 'playing':
      return 'Сейчас играет';
    case 'paused':
      return 'Пауза';
    case 'ended':
      return 'Завершено';
    default:
      return 'Ожидание трека...';
  }
}

/**
 * CurrentTrackDisplay for spring-cross-step theme.
 * Markup from reference: status row (dot + label), name, meta, time row, progress bar with knob.
 */
export const CurrentTrackDisplay: React.FC<SpringCrossStepCurrentTrackDisplayProps> = ({
  playbackState,
  playlist,
  className = '',
  themeId,
}) => {
  if (!playbackState || !playbackState.currentTrackId) {
    return (
      <div className={`party-current-track-display ${className}`} data-theme={themeId}>
        <div className="party-current-track-empty">
          <span className="party-current-track-empty-icon" aria-hidden>
            ♪
          </span>
          <p>Ожидание трека...</p>
        </div>
      </div>
    );
  }

  const playlistItems = playlist.items;
  const currentTrack = findTrack(playlistItems, playbackState.currentTrackId);

  if (!currentTrack || currentTrack.type !== 'track') {
    return null;
  }

  const progress =
    playbackState.duration > 0 ? (playbackState.position / playbackState.duration) * 100 : 0;
  const isPlaying = playbackState.status === 'playing';

  return (
    <div className={`party-current-track-display ${className}`} data-theme={themeId}>
      <div className="party-current-track-status">
        {isPlaying ? (
          <>
            <span className="party-display-session-dot" />
            {getStatusLabel(playbackState.status)}
          </>
        ) : (
          <>
            <span className="party-current-track-status-icon" aria-hidden>
              ⏸
            </span>
            {getStatusLabel(playbackState.status)}
          </>
        )}
      </div>
      <div className="party-current-track-name">{currentTrack.name}</div>
      {currentTrack.path && <div className="party-current-track-meta">{currentTrack.path}</div>}
      <div className="party-current-track-time">
        <span>{formatTime(playbackState.position)}</span>
        <span>{formatTime(playbackState.duration)}</span>
      </div>
      <div className="party-current-track-progress">
        <div className="party-current-track-progress-bar" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
};
