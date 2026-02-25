import React from 'react';

import { sortItemsByDisplayOrder } from '../../core/utils/playlist';
import { formatDuration } from '../../core/utils/time';
import { PartyPlaylistData, PlayerItem } from '../../types';

import { PlaylistItem } from './PlaylistItem';

export interface SpringCrossStepPlaylistViewProps {
  playlist: PartyPlaylistData;
  currentTrackId?: string | null;
  playedTrackIds?: string[];
  disabledTrackIds?: string[];
  disabledGroupIds?: string[];
  className?: string;
  themeId?: string;
}

function formatTotalDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h} ч ${m} мин`;
  return `${m} мин`;
}

function PlaylistIcon(): React.ReactElement {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0 }}
      aria-hidden
    >
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  );
}

/**
 * PlaylistView for spring-cross-step theme.
 * Header with icon + "Плейлист", stats with dot separators; same structure as reference.
 */
export const PlaylistView: React.FC<SpringCrossStepPlaylistViewProps> = ({
  playlist,
  currentTrackId = null,
  playedTrackIds = [],
  disabledTrackIds = [],
  disabledGroupIds = [],
  className = '',
  themeId,
}) => {
  const playedCount = playedTrackIds.length;
  const totalFormatted =
    playlist.totalDuration > 0 ? formatTotalDuration(playlist.totalDuration) : '0 мин';

  const renderItem = (item: PlayerItem, index: number, level: number = 0): React.ReactNode => {
    const isCurrent = item.id === currentTrackId;
    const isPlayed = playedTrackIds.includes(item.id);
    const isDisabled =
      item.type === 'track'
        ? disabledTrackIds.includes(item.id)
        : disabledGroupIds.includes(item.id);

    const sortedItems =
      item.type === 'group' && item.items ? sortItemsByDisplayOrder(item.items) : null;

    return (
      <React.Fragment key={item.id}>
        <PlaylistItem
          item={item}
          index={index}
          level={level}
          isCurrent={isCurrent}
          isPlayed={isPlayed}
          isDisabled={isDisabled}
        />
        {item.type === 'group' && sortedItems && sortedItems.length > 0 && (
          <div className="party-playlist-group-items">
            {sortedItems.map((childItem, childIndex) =>
              renderItem(childItem, childIndex, level + 1),
            )}
          </div>
        )}
      </React.Fragment>
    );
  };

  const sortedItems = sortItemsByDisplayOrder(playlist.items);

  return (
    <div className={`party-playlist-view ${className}`} data-theme={themeId}>
      <div className="party-playlist-header">
        <div className="party-playlist-header-title">
          <span className="party-playlist-header-icon">
            <PlaylistIcon />
          </span>
          <span className="party-playlist-header-label">Плейлист</span>
        </div>
        <div className="party-playlist-stats">
          <span>{playlist.totalTracks} треков</span>
          <span className="party-playlist-stats-separator" />
          <span>{totalFormatted}</span>
          <span className="party-playlist-stats-separator" />
          <span>{playedCount} сыграно</span>
        </div>
      </div>
      <div className="party-playlist-items">
        {sortedItems.length === 0 ? (
          <div className="party-playlist-empty">Плейлист пуст. Добавьте треки для вечеринки!</div>
        ) : (
          sortedItems.map((item, index) => renderItem(item, index, 0))
        )}
      </div>
    </div>
  );
};
