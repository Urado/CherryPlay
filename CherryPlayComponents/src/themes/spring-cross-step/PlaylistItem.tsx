import React, { useId, useRef, useState } from 'react';

import { useIsTruncated } from '../../core/hooks/useIsTruncated';
import { stripLastExtension } from '../../core/utils/string';
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
  const [nameExpanded, setNameExpanded] = useState(false);
  const idPrefix = useId();
  const nameRef = useRef<HTMLDivElement>(null);
  const displayName =
    item.type === 'track'
      ? stripLastExtension(item.name) || item.name || 'Трек'
      : item.name || 'Группа';
  const displayDuration =
    item.type === 'track' && item.duration != null ? formatDuration(item.duration) : null;

  const nameTruncated = useIsTruncated(nameRef, !nameExpanded, displayName);

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
          <div className="party-playlist-item-name-wrapper">
            <div
              ref={nameRef}
              className={`party-playlist-item-name${nameExpanded ? ' party-playlist-item-name--expanded' : ''}${!nameExpanded && nameTruncated ? ' party-playlist-item-name--inline-ellipsis' : ''}`}
              id={`${idPrefix}-name`}
            >
              {displayName}
            </div>
            {(nameExpanded || nameTruncated) && (
              <button
                type="button"
                className="party-playlist-item-expand-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setNameExpanded((v) => !v);
                }}
                aria-expanded={nameExpanded}
                aria-controls={`${idPrefix}-name`}
                aria-label={nameExpanded ? 'Свернуть название' : 'Показать полное название'}
                title={nameExpanded ? 'Свернуть название' : 'Показать полное название'}
              >
                {nameExpanded ? '×' : '…'}
              </button>
            )}
          </div>
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
