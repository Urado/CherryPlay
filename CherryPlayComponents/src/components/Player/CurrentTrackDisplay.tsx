/**
 * @deprecated Для фронта рекомендуется использовать единый компонент PartyDisplay.
 * Этот компонент оставлен для обратной совместимости и кастомных композиций.
 * Для темизации используйте компоненты из themes/<themeId>/CurrentTrackDisplay.
 */
import React from 'react';

import { findTrack } from '../../core/utils/playlist';
import { formatTime } from '../../core/utils/time';
import { ThemeId } from '../../themes';
import { PlaybackState, PlayerItem } from '../../types';

import './CurrentTrackDisplay.css';

export interface CurrentTrackDisplayProps {
  playbackState: PlaybackState | null;
  playlist: { items: PlayerItem[] };
  className?: string;
  themeId?: ThemeId;
}

export const CurrentTrackDisplay: React.FC<CurrentTrackDisplayProps> = ({
  playbackState,
  playlist,
  className = '',
  themeId,
}) => {
  if (!playbackState || !playbackState.currentTrackId) {
    return (
      <div className={`party-current-track-display ${className}`} data-theme={themeId}>
        <div className="party-current-track-empty">
          <p>Трек не выбран</p>
        </div>
      </div>
    );
  }

  const currentTrack = findTrack(playlist.items, playbackState.currentTrackId);

  if (!currentTrack || currentTrack.type !== 'track') {
    return (
      <div className={`party-current-track-display ${className}`} data-theme={themeId}>
        <div className="party-current-track-empty">
          <p>Трек не найден</p>
        </div>
      </div>
    );
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
