import React from 'react';

import { formatDuration } from '../../core/utils/time';
import { PlayerItem } from '../../types';

export interface SpringCrossStepPlaylistItemProps {
  item: PlayerItem;
  index: number;
  level: number;
  isCurrent?: boolean;
  isPlayed?: boolean;
  isDisabled?: boolean;
}

/** Иконка Music как в lucide-react (пример): две ноты, обводка */
function MusicIcon(): React.ReactElement {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  );
}

function CheckIcon(): React.ReactElement {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

/**
 * PlaylistItem for spring-cross-step theme.
 * Layout from reference: circle (number / Music / Check), name (+ optional path), duration.
 */
export const PlaylistItem: React.FC<SpringCrossStepPlaylistItemProps> = ({
  item,
  index,
  level: _level,
  isCurrent = false,
  isPlayed = false,
  isDisabled = false,
}) => {
  const isGroup = item.type === 'group';
  const displayName = item.name || (isGroup ? 'Группа' : 'Трек');
  const displayDuration =
    item.type === 'track' && item.duration != null ? formatDuration(item.duration) : null;

  const circleContent = isCurrent ? <MusicIcon /> : isPlayed ? <CheckIcon /> : index + 1;

  const stateClass = isCurrent ? 'current' : isPlayed ? 'played' : isDisabled ? 'disabled' : '';
  const rootClass = [
    'party-playlist-item',
    'party-playlist-item--track',
    isCurrent && 'party-playlist-item--current',
    isPlayed && 'party-playlist-item--played',
    isDisabled && 'party-playlist-item--disabled',
    stateClass,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={rootClass} role="button" tabIndex={0}>
      <div className="party-playlist-item-left">
        <div
          className="party-playlist-item-circle"
          data-state={isCurrent ? 'current' : isPlayed ? 'played' : 'upcoming'}
        >
          {circleContent}
        </div>
        <div className="party-playlist-item-info">
          <div className="party-playlist-item-name">{displayName}</div>
          {item.type === 'track' && item.path && (
            <div className="party-playlist-item-artist">{item.path}</div>
          )}
        </div>
      </div>
      {displayDuration != null && (
        <div className="party-playlist-item-duration">{displayDuration}</div>
      )}
    </div>
  );
};
