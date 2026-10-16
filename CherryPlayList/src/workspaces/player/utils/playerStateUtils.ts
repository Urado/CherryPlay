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

export const areItemsConsecutive = (
  itemIds: string[],
  items: ProjectItem[],
  getItemPath: (id: string) => string[],
  findItemById: (id: string) => ProjectItem | null,
): boolean => {
  if (itemIds.length < 2) return false;

  const itemPaths = itemIds.map((id) => ({
    id,
    path: getItemPath(id) || [],
  }));

  const firstPath = itemPaths[0].path;
  const parentId = firstPath.length > 1 ? firstPath[firstPath.length - 2] : null;

  for (let i = 1; i < itemPaths.length; i++) {
    const currentPath = itemPaths[i].path;
    const currentParentId = currentPath.length > 1 ? currentPath[currentPath.length - 2] : null;
    if (currentParentId !== parentId) {
      return false;
    }
  }

  let parentContainer: ProjectItem[];
  if (parentId === null) {
    parentContainer = items;
  } else {
    const parentGroup = findItemById(parentId);
    if (!parentGroup || !isProjectGroup(parentGroup)) {
      return false;
    }
    parentContainer = parentGroup.items;
  }

  const itemIndices: number[] = [];
  for (const itemId of itemIds) {
    const index = parentContainer.findIndex((item) => item.id === itemId);
    if (index === -1) {
      return false;
    }
    itemIndices.push(index);
  }

  const sortedIndices = [...itemIndices].sort((a, b) => a - b);
  for (let i = 1; i < sortedIndices.length; i++) {
    if (sortedIndices[i] !== sortedIndices[i - 1] + 1) {
      return false;
    }
  }

  return true;
};
