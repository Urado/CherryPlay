import React, { useMemo } from 'react';

import { getFlatTracksInDisplayOrder, sortItemsByDisplayOrder } from '../../core/utils/playlist';
import type { PartyPlaylistData, PlayerItem } from '../../types';

import { PlaylistItem } from './PlaylistItem';
import '../../components/Playlist/PlaylistView.css';

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

export interface BasePlaylistViewProps {
  playlist: PartyPlaylistData;
  currentTrackId?: string | null;
  playedTrackIds?: string[];
  disabledTrackIds?: string[];
  disabledGroupIds?: string[];
  isSessionActive?: boolean;
  className?: string;
  themeId?: string;
}

export const PlaylistView: React.FC<BasePlaylistViewProps> = ({
  playlist,
  currentTrackId = null,
  playedTrackIds = [],
  disabledTrackIds = [],
  disabledGroupIds = [],
  isSessionActive = true,
  className = '',
  themeId,
}) => {
  const flatTracks = useMemo(() => getFlatTracksInDisplayOrder(playlist.items), [playlist.items]);

  const notYetPlayedCount = useMemo(
    () =>
      flatTracks.filter(
        (t) =>
          !disabledTrackIds.includes(t.id) &&
          t.id !== currentTrackId &&
          !playedTrackIds.includes(t.id),
      ).length,
    [flatTracks, disabledTrackIds, currentTrackId, playedTrackIds],
  );

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
      </React.Fragment>
    );
  };

  const statsLabel =
    !isSessionActive && notYetPlayedCount === 0
      ? 'Вечеринка окончена'
      : notYetPlayedCount === 0
        ? 'Сейчас последний трек'
        : notYetPlayedCount === 1
          ? 'Последний трек'
          : null;

  return (
    <div className={`party-playlist-view ${className}`} data-theme={themeId}>
      <div className="party-playlist-header" aria-label="Плейлист и статистика">
        <div className="party-playlist-header-title">
          <span className="party-playlist-header-icon" aria-hidden>
            <PlaylistIcon />
          </span>
          <span className="party-playlist-header-label">Плейлист</span>
        </div>
        <div className="party-playlist-stats">
          {statsLabel !== null ? (
            <span className="party-playlist-stats-not-yet-played">{statsLabel}</span>
          ) : (
            <>
              <span className="party-playlist-stats-remaining-label">Осталось треков:</span>
              <span className="party-playlist-stats-not-yet-played">{notYetPlayedCount}</span>
            </>
          )}
        </div>
      </div>
      <div className="party-playlist-items" role="list">
        {playlist.items.length === 0 ? (
          <div className="party-playlist-empty">
            <p>Плейлист пуст</p>
          </div>
        ) : (
          sortItemsByDisplayOrder(playlist.items).map((item, index) => renderItem(item, index, 0))
        )}
      </div>
    </div>
  );
};
