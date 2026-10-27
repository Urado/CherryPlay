import { ProjectItem, isProjectGroup, isProjectTrack } from '@core/types/project';
import { Track } from '@core/types/track';

export const isTrackOrGroupDisabled = (
  itemId: string,
  isTrackDisabled: (id: string) => boolean,
  isGroupDisabled: (id: string) => boolean,
  getItemPath: (id: string) => string[],
  findItemById: (id: string) => ProjectItem | null,
): boolean => {
  if (isTrackDisabled(itemId)) {
    return true;
  }

  const path = getItemPath(itemId);
  if (path.length > 1) {
    for (let i = path.length - 2; i >= 0; i--) {
      const groupId = path[i];
      const item = findItemById(groupId);
      if (item && isProjectGroup(item) && isGroupDisabled(groupId)) {
        return true;
      }
    }
  }

  return false;
};

export const isTrackActive = (
  trackId: string,
  isTrackPlayed: (id: string) => boolean,
  isTrackOrGroupDisabled: (id: string) => boolean,
): boolean => {
  return !isTrackPlayed(trackId) && !isTrackOrGroupDisabled(trackId);
};

export const markSkippedDisabledTracks = (
  fromIndex: number,
  toIndex: number,
  allTracks: Track[],
  isTrackOrGroupDisabled: (id: string) => boolean,
  isTrackPlayed: (id: string) => boolean,
  markTrackAsPlayed: (id: string) => void,
): void => {
  for (let i = fromIndex + 1; i < toIndex; i++) {
    const track = allTracks[i];
    if (track && isTrackOrGroupDisabled(track.id) && !isTrackPlayed(track.id)) {
      markTrackAsPlayed(track.id);
    }
  }
};

export const canRemoveSelectedItems = (
  selectedItemIds: Set<string>,
  isPreparationMode: boolean,
  activePlayerTrackId: string | null | undefined,
  findItemById: (id: string) => ProjectItem | null,
  isTrackPlayed: (id: string) => boolean,
  getAllTracksInOrder: (items: ProjectItem[]) => Track[],
): boolean => {
  if (isPreparationMode) {
    return true;
  }

  return Array.from(selectedItemIds).every((itemId) => {
    const item = findItemById(itemId);
    if (!item) {
      return true;
    }

    if (isProjectTrack(item)) {
      const trackIsPlayed = isTrackPlayed(itemId);
      const isCurrentTrack = itemId === activePlayerTrackId;
      return !trackIsPlayed && !isCurrentTrack;
    }

    if (isProjectGroup(item)) {
      const groupTracks = getAllTracksInOrder([item]);
      return groupTracks.every((track) => {
        const trackIsPlayed = isTrackPlayed(track.id);
        const isCurrentTrack = track.id === activePlayerTrackId;
        return !trackIsPlayed && !isCurrentTrack;
      });
    }

    return true;
  });
};
