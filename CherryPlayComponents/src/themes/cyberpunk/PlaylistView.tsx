import React from 'react';

import { PartyPlaylistData, PlayerItem } from '../../types';
import { ThemeId } from '../../themes';
import { sortItemsByDisplayOrder } from '../../core/utils/playlist';
import { formatDuration } from '../../core/utils/time';

import { PlaylistItem } from './PlaylistItem';
import '../../components/Playlist/PlaylistView.css';

export interface CyberpunkPlaylistViewProps {
  playlist: PartyPlaylistData;
  currentTrackId?: string | null;
  playedTrackIds?: string[];
  disabledTrackIds?: string[];
  disabledGroupIds?: string[];
  className?: string;
  themeId?: ThemeId;
}

export const PlaylistView: React.FC<CyberpunkPlaylistViewProps> = ({
  playlist,
  currentTrackId = null,
  playedTrackIds = [],
  disabledTrackIds = [],
  disabledGroupIds = [],
  className = '',
  themeId,
}) => {
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
      <PlaylistItem
        key={item.id}
        item={item}
        index={index}
        level={level}
        isCurrent={isCurrent}
        isPlayed={isPlayed}
        isDisabled={isDisabled}
      >
        {item.type === 'group' && sortedItems && sortedItems.length > 0 && (
          <div
            className="party-playlist-group-items"
            style={{ marginLeft: `${(level + 1) * 20}px` }}
          >
            {sortedItems.map((childItem, childIndex) =>
              renderItem(childItem, childIndex, level + 1),
            )}
          </div>
        )}
      </PlaylistItem>
    );
  };

  return (
    <div className={`party-playlist-view ${className}`} data-theme={themeId}>
      <div className="party-playlist-header">
        <div className="party-playlist-stats">
          <span>{playlist.totalTracks} треков</span>
          {playlist.totalDuration > 0 && (
            <>
              <span className="party-playlist-stats-separator">•</span>
              <span>{formatDuration(playlist.totalDuration)}</span>
            </>
          )}
        </div>
      </div>
      <div className="party-playlist-items">
        {playlist.items.length === 0 ? (
          <div className="party-playlist-empty">
            <p>Плейлист пуст</p>
          </div>
        ) : (
          sortItemsByDisplayOrder(playlist.items).map((item, index) =>
            renderItem(item, index, 0),
          )
        )}
      </div>
    </div>
  );
};


