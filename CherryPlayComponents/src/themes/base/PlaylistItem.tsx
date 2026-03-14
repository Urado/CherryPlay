import React, { useId, useRef, useState } from 'react';

import { useIsTruncated } from '../../core/hooks/useIsTruncated';
import { stripLastExtension } from '../../core/utils/string';
import { formatDuration } from '../../core/utils/time';
import { PlayerItem } from '../../types';

import '../../components/Playlist/PlaylistItem.css';

function PlayIcon(): React.ReactElement {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function CheckIcon(): React.ReactElement {
  return (
    <svg
      width="12"
      height="12"
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

function CrossIcon(): React.ReactElement {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export interface BasePlaylistItemProps {
  item: PlayerItem;
  index: number;
  level: number;
  /** 1-based display number (excluding disabled); shown in circle for upcoming tracks */
  trackNumber?: number;
  isCurrent?: boolean;
  isPlayed?: boolean;
  isDisabled?: boolean;
  children?: React.ReactNode;
}

export const PlaylistItem: React.FC<BasePlaylistItemProps> = ({
  item,
  index: _index,
  level,
  trackNumber,
  isCurrent = false,
  isPlayed = false,
  isDisabled = false,
  children,
}) => {
  const [nameExpanded, setNameExpanded] = useState(false);
  const nameRef = useRef<HTMLDivElement>(null);
  const idPrefix = useId();

  const isGroup = item.type === 'group';
  const displayName =
    item.type === 'track'
      ? stripLastExtension(item.name) || item.name || 'Трек'
      : item.name || 'Группа';
  const displayDuration =
    item.type === 'track' && item.duration != null ? formatDuration(item.duration) : null;

  const nameTruncated = useIsTruncated(nameRef, !nameExpanded, displayName);

  const dataState = isDisabled
    ? 'disabled'
    : isCurrent
      ? 'current'
      : isPlayed
        ? 'played'
        : 'upcoming';

  const rowTitle = isDisabled ? 'Трек отменён' : undefined;

  const displayNumber =
    item.type === 'track' && !isDisabled && !isCurrent && !isPlayed
      ? (trackNumber ?? _index + 1)
      : null;

  const circleContent = isDisabled ? (
    <CrossIcon />
  ) : isCurrent ? (
    <PlayIcon />
  ) : isPlayed ? (
    <CheckIcon />
  ) : item.type === 'track' && displayNumber != null ? (
    displayNumber
  ) : null;

  return (
    <div
      className={`party-playlist-item ${isGroup ? 'party-playlist-item--group' : 'party-playlist-item--track'} ${
        isCurrent ? 'party-playlist-item--current' : ''
      } ${isPlayed ? 'party-playlist-item--played' : ''} ${isDisabled ? 'party-playlist-item--disabled' : ''}`}
      style={{ paddingLeft: `${level * 20}px` }}
      title={rowTitle}
    >
      <div className="party-playlist-item-row">
        <div className="party-playlist-item-state">
          <div className="party-playlist-item-circle" data-state={dataState}>
            {circleContent}
          </div>
        </div>
        <div className="party-playlist-item-info">
          <div className="party-playlist-item-name-wrap">
            <div
              ref={nameRef}
              className={`party-playlist-item-name${nameExpanded ? ' party-playlist-item-name--expanded' : ''}`}
              id={`${idPrefix}-name`}
            >
              {displayName}
            </div>
            {(nameExpanded || nameTruncated) && (
              <button
                type="button"
                className="party-playlist-item-expand"
                onClick={() => setNameExpanded((v) => !v)}
                aria-expanded={nameExpanded}
                aria-controls={`${idPrefix}-name`}
                aria-label={nameExpanded ? 'Свернуть название' : 'Показать полное название'}
                title={nameExpanded ? 'Свернуть название' : 'Показать полное название'}
              >
                {nameExpanded ? '×' : '…'}
              </button>
            )}
          </div>
        </div>
        {displayDuration != null && (
          <span className="party-playlist-item-duration">{displayDuration}</span>
        )}
      </div>
      {children}
    </div>
  );
};
