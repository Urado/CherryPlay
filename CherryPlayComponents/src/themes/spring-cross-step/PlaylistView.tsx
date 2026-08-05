import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { getFlatTracksInDisplayOrder, sortItemsByDisplayOrder } from '../../core/utils/playlist';
import { PartyPlaylistData, PlayerItem } from '../../types';

import { PlaylistItem } from './PlaylistItem';

export interface SpringCrossStepPlaylistViewProps {
  playlist: PartyPlaylistData;
  currentTrackId?: string | null;
  playedTrackIds?: string[];
  disabledTrackIds?: string[];
  disabledGroupIds?: string[];
  isSessionActive?: boolean;
  className?: string;
  themeId?: string;
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

export const PlaylistView: React.FC<SpringCrossStepPlaylistViewProps> = ({
  playlist,
  currentTrackId = null,
  playedTrackIds = [],
  disabledTrackIds = [],
  disabledGroupIds = [],
  isSessionActive = true,
  className = '',
  themeId,
}) => {
  const [activeCancelPopupTrackId, setActiveCancelPopupTrackId] = useState<string | null>(null);
  const cancelPopupTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onCancelIconClick = useCallback((trackId: string) => {
    if (cancelPopupTimeoutRef.current) {
      clearTimeout(cancelPopupTimeoutRef.current);
      cancelPopupTimeoutRef.current = null;
    }
    setActiveCancelPopupTrackId(trackId);
    cancelPopupTimeoutRef.current = setTimeout(() => {
      setActiveCancelPopupTrackId(null);
      cancelPopupTimeoutRef.current = null;
    }, 10000);
  }, []);

  useEffect(() => {
    return () => {
      if (cancelPopupTimeoutRef.current) clearTimeout(cancelPopupTimeoutRef.current);
    };
  }, []);

  const flatTracks = useMemo(() => getFlatTracksInDisplayOrder(playlist.items), [playlist.items]);

  const trackNumberByItemId = useMemo(() => {
    const map: Record<string, number> = {};
    let n = 0;
    for (const t of flatTracks) {
      if (!disabledTrackIds.includes(t.id)) {
        n += 1;
        map[t.id] = n;
      }
    }
    return map;
  }, [flatTracks, disabledTrackIds]);

  const notYetPlayedCount = useMemo(() => {
    return flatTracks.filter(
      (t) =>
        !disabledTrackIds.includes(t.id) &&
        t.id !== currentTrackId &&
        !playedTrackIds.includes(t.id),
    ).length;
  }, [flatTracks, disabledTrackIds, currentTrackId, playedTrackIds]);

  const renderItem = (item: PlayerItem, index: number, level: number = 0): React.ReactNode => {
    const isCurrent = item.id === currentTrackId;
    const isPlayed = playedTrackIds.includes(item.id);
    const isDisabled =
      item.type === 'track'
        ? disabledTrackIds.includes(item.id)
        : disabledGroupIds.includes(item.id);

    const sortedItems =
      item.type === 'group' && item.items ? sortItemsByDisplayOrder(item.items) : null;

    const trackNumber = item.type === 'track' ? trackNumberByItemId[item.id] : undefined;

    return (
      <React.Fragment key={`${item.id}-${level}-${index}`}>
        <PlaylistItem
          item={item}
          index={index}
          level={level}
          trackNumber={trackNumber}
          isCurrent={isCurrent}
          isPlayed={isPlayed}
          isDisabled={isDisabled}
          onCancelIconClick={onCancelIconClick}
          showCancelPopupFromParent={activeCancelPopupTrackId === item.id}
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
          {flatTracks.length === 0 ? (
            <>
              <span className="party-playlist-stats-remaining-label">Осталось треков:</span>
              <span className="party-playlist-stats-not-yet-played">{notYetPlayedCount}</span>
            </>
          ) : !isSessionActive && notYetPlayedCount === 0 ? (
            <span className="party-playlist-stats-not-yet-played">Вечеринка окончена</span>
          ) : notYetPlayedCount === 0 ? (
            <span className="party-playlist-stats-not-yet-played">Сейчас последний трек</span>
          ) : notYetPlayedCount === 1 ? (
            <span className="party-playlist-stats-not-yet-played">Остался последний трек</span>
          ) : (
            <>
              <span className="party-playlist-stats-remaining-label">Осталось треков:</span>
              <span className="party-playlist-stats-not-yet-played">{notYetPlayedCount}</span>
            </>
          )}
        </div>
      </div>
      <div className="party-playlist-items" role="list">
        {sortedItems.length === 0 ? (
          <div className="party-playlist-empty">Плейлист пуст. Добавьте треки для вечеринки!</div>
        ) : (
          sortedItems.map((item, index) => renderItem(item, index, 0))
        )}
      </div>
    </div>
  );
};
