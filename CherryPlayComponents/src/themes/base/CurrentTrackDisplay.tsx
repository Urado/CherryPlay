import React, { useId, useRef, useState } from 'react';

import { useIsTruncated } from '../../core/hooks/useIsTruncated';
import { findTrack, getFlatTracksInDisplayOrder } from '../../core/utils/playlist';
import { stripLastExtension } from '../../core/utils/string';
import { formatDuration, formatTime } from '../../core/utils/time';
import { PlaybackState, PlayerItem, PartyPlaylistData } from '../../types';

import '../../components/Player/CurrentTrackDisplay.css';

export interface BaseCurrentTrackDisplayProps {
  playbackState: PlaybackState | null;
  playlist: PartyPlaylistData | { items: PlayerItem[] };
  className?: string;
  themeId?: string;
}

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

export const CurrentTrackDisplay: React.FC<BaseCurrentTrackDisplayProps> = ({
  playbackState,
  playlist,
  className = '',
  themeId,
}) => {
  const [currentNameExpanded, setCurrentNameExpanded] = useState(false);
  const [prevNameExpanded, setPrevNameExpanded] = useState(false);
  const [nextNameExpanded, setNextNameExpanded] = useState(false);
  const idPrefix = useId();
  const currentNameRef = useRef<HTMLDivElement>(null);
  const prevNameRef = useRef<HTMLDivElement>(null);
  const nextNameRef = useRef<HTMLDivElement>(null);

  const playlistItems = playlist?.items ?? [];
  const currentTrack =
    playbackState?.currentTrackId != null
      ? findTrack(playlistItems, playbackState.currentTrackId)
      : null;
  const flatTracks = getFlatTracksInDisplayOrder(playlistItems);
  const currentIndex =
    currentTrack != null && playbackState?.currentTrackId != null
      ? flatTracks.findIndex((t) => t.id === playbackState.currentTrackId)
      : -1;
  const hasMultipleTracks = flatTracks.length > 1;
  const prevTrack = currentIndex > 0 ? flatTracks[currentIndex - 1]! : null;
  const nextTrack =
    currentIndex >= 0 && currentIndex < flatTracks.length - 1
      ? flatTracks[currentIndex + 1]!
      : null;

  const currentDisplayName =
    currentTrack && currentTrack.type === 'track' ? stripLastExtension(currentTrack.name) : '';
  const prevDisplayName = prevTrack ? stripLastExtension(prevTrack.name) : '';
  const nextDisplayName = nextTrack ? stripLastExtension(nextTrack.name) : '';

  const currentTruncated = useIsTruncated(currentNameRef, !currentNameExpanded, currentDisplayName);
  const prevTruncated = useIsTruncated(prevNameRef, !prevNameExpanded, prevDisplayName);
  const nextTruncated = useIsTruncated(nextNameRef, !nextNameExpanded, nextDisplayName);

  if (!playbackState || !playbackState.currentTrackId) {
    return (
      <div className={`party-current-track-display ${className}`} data-theme={themeId}>
        <div className="party-current-track-empty">Нет воспроизведения</div>
      </div>
    );
  }

  if (!currentTrack || currentTrack.type !== 'track') {
    return (
      <div className={`party-current-track-display ${className}`} data-theme={themeId}>
        <div className="party-current-track-empty">Нет воспроизведения</div>
      </div>
    );
  }

  const progress =
    playbackState.duration > 0 ? (playbackState.position / playbackState.duration) * 100 : 0;

  return (
    <div className={`party-current-track-display ${className}`} data-theme={themeId}>
      {hasMultipleTracks && prevTrack && (
        <div className="party-current-track-prev" aria-label="Предыдущий трек">
          <span className="party-current-track-adjacent-label">Предыдущий</span>
          <div className="party-current-track-adjacent-name-wrapper">
            <div
              ref={prevNameRef}
              className={`party-current-track-adjacent-name${prevNameExpanded ? ' party-current-track-adjacent-name--expanded' : ''}`}
              id={`${idPrefix}-prev-name`}
            >
              {prevDisplayName}
            </div>
            {(prevNameExpanded || prevTruncated) && (
              <button
                type="button"
                className="party-current-track-expand-btn"
                onClick={() => setPrevNameExpanded((v) => !v)}
                aria-expanded={prevNameExpanded}
                aria-controls={`${idPrefix}-prev-name`}
                aria-label={prevNameExpanded ? 'Свернуть название' : 'Показать полное название'}
                title={prevNameExpanded ? 'Свернуть название' : 'Показать полное название'}
              >
                {prevNameExpanded ? '×' : '…'}
              </button>
            )}
            {prevTrack.duration != null && (
              <span
                className="party-current-track-adjacent-time"
                aria-label={`Длительность: ${formatDuration(prevTrack.duration)}`}
              >
                {formatDuration(prevTrack.duration)}
              </span>
            )}
          </div>
        </div>
      )}

      <div className="party-current-track-current" aria-label={getStatusText(playbackState.status)}>
        <div className="party-current-track-info">
          <div className="party-current-track-name-wrapper">
            <div
              ref={currentNameRef}
              className={`party-current-track-name${currentNameExpanded ? ' party-current-track-name--expanded' : ''}`}
              id={`${idPrefix}-current-name`}
            >
              {currentDisplayName}
            </div>
            {(currentNameExpanded || currentTruncated) && (
              <button
                type="button"
                className="party-current-track-expand-btn"
                onClick={() => setCurrentNameExpanded((v) => !v)}
                aria-expanded={currentNameExpanded}
                aria-controls={`${idPrefix}-current-name`}
                aria-label={currentNameExpanded ? 'Свернуть название' : 'Показать полное название'}
                title={currentNameExpanded ? 'Свернуть название' : 'Показать полное название'}
              >
                {currentNameExpanded ? '×' : '…'}
              </button>
            )}
          </div>
          <div className="party-current-track-meta">
            <span className="party-current-track-status">
              {getStatusText(playbackState.status)}
            </span>
            <span className="party-current-track-time">
              {formatTime(playbackState.position)} / {formatTime(playbackState.duration)}
            </span>
          </div>
        </div>
        <div className="party-current-track-progress">
          <div className="party-current-track-progress-bar" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {hasMultipleTracks && nextTrack && (
        <div className="party-current-track-next" aria-label="Следующий трек">
          <span className="party-current-track-adjacent-label">Следующий</span>
          <div className="party-current-track-adjacent-name-wrapper">
            <div
              ref={nextNameRef}
              className={`party-current-track-adjacent-name${nextNameExpanded ? ' party-current-track-adjacent-name--expanded' : ''}`}
              id={`${idPrefix}-next-name`}
            >
              {nextDisplayName}
            </div>
            {(nextNameExpanded || nextTruncated) && (
              <button
                type="button"
                className="party-current-track-expand-btn"
                onClick={() => setNextNameExpanded((v) => !v)}
                aria-expanded={nextNameExpanded}
                aria-controls={`${idPrefix}-next-name`}
                aria-label={nextNameExpanded ? 'Свернуть название' : 'Показать полное название'}
                title={nextNameExpanded ? 'Свернуть название' : 'Показать полное название'}
              >
                {nextNameExpanded ? '×' : '…'}
              </button>
            )}
            {nextTrack.duration != null && (
              <span
                className="party-current-track-adjacent-time"
                aria-label={`Длительность: ${formatDuration(nextTrack.duration)}`}
              >
                {formatDuration(nextTrack.duration)}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
