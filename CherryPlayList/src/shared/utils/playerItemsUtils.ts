import { ProjectGroup, ProjectItem, isProjectGroup, isProjectTrack } from '@core/types/project';
import { Track } from '@core/types/track';

export interface DisplayItem {
  item: ProjectItem;
  level: number;
  displayIndex: number;
  flatIndex: number;
  parentGroupId: string | null;
}

function flattenItemsRecursive(
  items: ProjectItem[],
  level: number,
  trackIndex: number,
  flatIndex: number,
  parentGroupId: string | null,
): { result: DisplayItem[]; nextTrackIndex: number; nextFlatIndex: number } {
  const result: DisplayItem[] = [];
  let currentTrackIndex = trackIndex;
  let currentFlatIndex = flatIndex;

  for (const item of items) {
    const isItemGroup = isProjectGroup(item);
    const itemDisplayIndex = isItemGroup ? -1 : currentTrackIndex++;

    result.push({
      item,
      level,
      displayIndex: itemDisplayIndex,
      flatIndex: currentFlatIndex++,
      parentGroupId,
    });

    if (isItemGroup) {
      const nested = flattenItemsRecursive(
        item.items,
        level + 1,
        currentTrackIndex,
        currentFlatIndex,
        item.id,
      );
      result.push(...nested.result);
      currentTrackIndex = nested.nextTrackIndex;
      currentFlatIndex = nested.nextFlatIndex;
    }
  }

  return { result, nextTrackIndex: currentTrackIndex, nextFlatIndex: currentFlatIndex };
}

export function flattenItemsForDisplay(items: ProjectItem[]): DisplayItem[] {
  const { result } = flattenItemsRecursive(items, 0, 0, 0, null);
  return result;
}

function getAllTracksFromGroup(group: ProjectGroup): Track[] {
  const tracks: Track[] = [];
  for (const item of group.items) {
    if (isProjectTrack(item)) {
      tracks.push(item);
    } else if (isProjectGroup(item)) {
      tracks.push(...getAllTracksFromGroup(item));
    }
  }
  return tracks;
}

export function getGroupItemCount(group: ProjectGroup): number {
  let count = 0;
  for (const item of group.items) {
    count++;
    if (isProjectGroup(item)) {
      count += getGroupItemCount(item);
    }
  }
  return count;
}

export function getGroupTotalDuration(group: ProjectGroup): number {
  const tracks = getAllTracksFromGroup(group);
  return tracks.reduce((sum, track) => sum + (track.duration || 0), 0);
}

export function getTracksFromDisplayItems(displayItems: DisplayItem[]): Track[] {
  const tracks: Track[] = [];
  for (const displayItem of displayItems) {
    if (isProjectTrack(displayItem.item)) {
      tracks.push(displayItem.item);
    }
  }
  return tracks;
}

export function getGroupWithNestedIds(groupId: string, displayItems: DisplayItem[]): string[] {
  const ids: string[] = [];

  const groupIndex = displayItems.findIndex((di) => di.item.id === groupId);
  if (groupIndex === -1) {
    return ids;
  }

  const groupDisplayItem = displayItems[groupIndex];
  if (!isProjectGroup(groupDisplayItem.item)) {
    return [groupId];
  }

  ids.push(groupId);

  const groupLevel = groupDisplayItem.level;
  for (let i = groupIndex + 1; i < displayItems.length; i++) {
    const di = displayItems[i];
    if (di.level <= groupLevel) {
      break;
    }
    ids.push(di.item.id);
  }

  return ids;
}

export function expandSelectionWithGroupContents(
  selectedIds: Set<string>,
  displayItems: DisplayItem[],
): Set<string> {
  const expandedIds = new Set<string>();

  for (const di of displayItems) {
    if (selectedIds.has(di.item.id)) {
      expandedIds.add(di.item.id);

      if (isProjectGroup(di.item)) {
        const nestedIds = getGroupWithNestedIds(di.item.id, displayItems);
        nestedIds.forEach((nestedId) => expandedIds.add(nestedId));
      }
    } else if (di.parentGroupId && selectedIds.has(di.parentGroupId)) {
      expandedIds.add(di.item.id);
    } else {
      let parentId = di.parentGroupId;
      while (parentId) {
        if (selectedIds.has(parentId)) {
          expandedIds.add(di.item.id);
          break;
        }
        const parentDi = displayItems.find((d) => d.item.id === parentId);
        parentId = parentDi?.parentGroupId ?? null;
      }
    }
  }

  return expandedIds;
}
