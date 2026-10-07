import React, { useMemo } from 'react';

import { sortItemsByDisplayOrder } from '../../core/utils/playlist';
import type { PartyPlaylistData, PlayerItem } from '../../types';

import { PlaylistItem } from './PlaylistItem';
import '../../components/Playlist/PlaylistView.css';

const PlaylistIcon = (): React.ReactElement => {
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
  groupDisplayDepth?: number;
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
  groupDisplayDepth = 3,
  isSessionActive = true,
  className = '',
  themeId,
}) => {
  const flatTracks = useMemo(() => {
    const tracks: PlayerItem[] = [];
    const collectTracks = (items: PlayerItem[], parentDisabled = false) => {
      for (const item of sortItemsByDisplayOrder(items)) {
        const isDisabled = parentDisabled || (item.type === 'group' && disabledGroupIds.includes(item.id));
        if (item.type === 'track') {
          if (!isDisabled) tracks.push(item);
        } else if (item.items) {
          collectTracks(item.items, isDisabled);
        }
      }
    };
    collectTracks(playlist.items);
    return tracks;
  }, [playlist.items, disabledGroupIds]);

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

  const groupStatsById = useMemo(() => {
    const stats = new Map<string, { count: number; played: number; duration: number | null }>();
    const collectStats = (
      item: PlayerItem,
      parentDisabled = false,
    ): { count: number; played: number; duration: number | null } => {
      const isDisabled =
        parentDisabled ||
        (item.type === 'track'
          ? disabledTrackIds.includes(item.id)
          : disabledGroupIds.includes(item.id));
      if (item.type === 'track') {
        return {
          count: isDisabled ? 0 : 1,
          played: !isDisabled && playedTrackIds.includes(item.id) ? 1 : 0,
          duration: isDisabled ? 0 : (item.duration ?? null),
        };
      }
      const aggregate = (item.items ?? []).reduce<{
        count: number;
        played: number;
        duration: number | null;
      }>(
        (total, child) => {
          const childStats = collectStats(child, isDisabled);
          return {
            count: total.count + childStats.count,
            played: total.played + childStats.played,
            duration:
              total.duration === null || childStats.duration === null
                ? null
                : total.duration + childStats.duration,
          };
        },
        { count: 0, played: 0, duration: 0 },
      );
      stats.set(item.id, aggregate);
      return aggregate;
    };
    playlist.items.forEach((item) => collectStats(item));
    return stats;
  }, [playlist.items, disabledTrackIds, disabledGroupIds, playedTrackIds]);

  const maxGroupDepthById = useMemo(() => {
    const depths = new Map<string, number>();
    const measureDepth = (item: PlayerItem): number => {
      if (item.type === 'track') return 0;
      const depth =
        1 +
        (item.items ?? []).reduce(
          (maximum, child) => Math.max(maximum, measureDepth(child)),
          0,
        );
      depths.set(item.id, depth);
      return depth;
    };
    playlist.items.forEach(measureDepth);
    return depths;
  }, [playlist.items]);

  const renderItem = (
    item: PlayerItem,
    index: number,
    level = 0,
    parentDisabled = false,
  ): React.ReactNode => {
    const isCurrent = item.id === currentTrackId;
    const isPlayed = playedTrackIds.includes(item.id);
    const isDisabled =
      parentDisabled ||
      (item.type === 'track'
        ? disabledTrackIds.includes(item.id)
        : disabledGroupIds.includes(item.id));

    const sortedItems =
      item.type === 'group' && item.items ? sortItemsByDisplayOrder(item.items) : null;

    if (item.type === 'group' && (groupDisplayDepth === 0 || (maxGroupDepthById.get(item.id) ?? 1) > groupDisplayDepth)) {
      return (
        <React.Fragment key={`${item.id}-${level}-${index}`}>
          {sortedItems?.map((childItem, childIndex) =>
            renderItem(childItem, childIndex, level, isDisabled),
          )}
        </React.Fragment>
      );
    }

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
          groupStats={item.type === 'group' ? groupStatsById.get(item.id) : undefined}
        >
          {item.type === 'group' && sortedItems && sortedItems.length > 0 && (
            <div className="party-playlist-group-items">
              {sortedItems.map((childItem, childIndex) =>
                renderItem(childItem, childIndex, level + 1, isDisabled),
              )}
            </div>
          )}
        </PlaylistItem>
      </React.Fragment>
    );
  };

  const totalTracks = flatTracks.length;
  const statsLabel =
    totalTracks === 0
      ? null
      : !isSessionActive && notYetPlayedCount === 0
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
