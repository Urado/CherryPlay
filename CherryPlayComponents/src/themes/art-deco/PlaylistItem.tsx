import React from 'react';

import { PlayerItem } from '../../types';
import { formatDuration } from '../../core/utils/time';

import '../../components/Playlist/PlaylistItem.css';

export interface ArtDecoPlaylistItemProps {
  item: PlayerItem;
  index: number;
  level: number;
  isCurrent?: boolean;
  isPlayed?: boolean;
  isDisabled?: boolean;
  children?: React.ReactNode;
}

export const PlaylistItem: React.FC<ArtDecoPlaylistItemProps> = ({
  item,
  index: _index,
  level,
  isCurrent = false,
  isPlayed = false,
  isDisabled = false,
  children,
}) => {
  const isGroup = item.type === 'group';
  const displayName = item.name || (isGroup ? 'Группа' : 'Трек');
  const displayDuration = item.duration ? formatDuration(item.duration) : null;

  return (
    <div
      className={`party-playlist-item ${isGroup ? 'party-playlist-item--group' : 'party-playlist-item--track'} ${
        isCurrent ? 'party-playlist-item--current' : ''
      } ${isPlayed ? 'party-playlist-item--played' : ''} ${isDisabled ? 'party-playlist-item--disabled' : ''}`}
      style={{ paddingLeft: `${level * 20}px` }}
    >
      <div className="party-playlist-item-content">
        <div className="party-playlist-item-main">
          {isGroup && (
            <span className="party-playlist-item-group-icon" aria-label="Группа">
              📁
            </span>
          )}
          <span className="party-playlist-item-name">{displayName}</span>
          {displayDuration && <span className="party-playlist-item-duration">{displayDuration}</span>}
        </div>
      </div>
      {children}
    </div>
  );
};


