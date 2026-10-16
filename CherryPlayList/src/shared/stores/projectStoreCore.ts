import { isProjectGroup, isProjectTrack, ProjectGroup, ProjectItem } from '@core/types/project';
import { Track, type TrackLoudness } from '@core/types/track';

export interface ItemPositionInfo {
  item: ProjectItem;
  parentPath: string[];
  indexInParent: number;
}

export interface FlatListItem {
  item: ProjectItem;
  path: string[];
}

export const findItemRecursive = (items: ProjectItem[], id: string): ProjectItem | null => {
  for (const item of items) {
    if (item.id === id) {
      return item;
    }
    if (isProjectGroup(item)) {
      const found = findItemRecursive(item.items, id);
      if (found) {
        return found;
      }
    }
  }
  return null;
}

export const getItemPathRecursive = (
  items: ProjectItem[],
  itemId: string,
  currentPath: string[] = [],
): string[] | null => {
  for (const item of items) {
    const newPath = [...currentPath, item.id];
    if (item.id === itemId) {
      return newPath;
    }
    if (isProjectGroup(item)) {
      const found = getItemPathRecursive(item.items, itemId, newPath);
      if (found) {
        return found;
      }
    }
  }
  return null;
}

export const findItemWithParent = (items: ProjectItem[], itemId: string): ItemPositionInfo | null => {
  const rootIndex = items.findIndex((item) => item.id === itemId);
  if (rootIndex !== -1) {
    return {
      item: items[rootIndex],
      parentPath: [],
      indexInParent: rootIndex,
    };
  }

  for (const item of items) {
    if (isProjectGroup(item)) {
      const childIndex = item.items.findIndex((child) => child.id === itemId);
      if (childIndex !== -1) {
        return {
          item: item.items[childIndex],
          parentPath: [item.id],
          indexInParent: childIndex,
        };
      }

      const nested = findItemWithParent(item.items, itemId);
      if (nested) {
        return {
          ...nested,
          parentPath: [item.id, ...nested.parentPath],
        };
      }
    }
  }

  return null;
}

export const getAllTracksRecursive = (items: ProjectItem[]): Track[] => {
  const tracks: Track[] = [];
  for (const item of items) {
    if (isProjectTrack(item)) {
      tracks.push(item);
    } else if (isProjectGroup(item)) {
      tracks.push(...getAllTracksRecursive(item.items));
    }
  }
  return tracks;
}

export const getFlatItemList = (items: ProjectItem[]): FlatListItem[] => {
  const result: FlatListItem[] = [];

  const traverse = (itemsToTraverse: ProjectItem[], currentPath: string[]): void => {
    for (const item of itemsToTraverse) {
      const itemPath = [...currentPath, item.id];
      result.push({ item, path: itemPath });
      if (isProjectGroup(item)) {
        traverse(item.items, itemPath);
      }
    }
  };

  traverse(items, []);
  return result;
}

export const collectAllItemIds = (item: ProjectItem): string[] => {
  const ids = [item.id];
  if (isProjectGroup(item)) {
    for (const child of item.items) {
      ids.push(...collectAllItemIds(child));
    }
  }
  return ids;
}

export const removeItemFromItems = (items: ProjectItem[], itemId: string): ProjectItem[] => {
  return items
    .filter((item) => item.id !== itemId)
    .map((item) => {
      if (isProjectGroup(item)) {
        return {
          ...item,
          items: removeItemFromItems(item.items, itemId),
        };
      }
      return item;
    });
}

export const updateTrackInItems = (
  items: ProjectItem[],
  trackId: string,
  duration: number,
): ProjectItem[] => {
  return items.map((item) => {
    if (isProjectTrack(item) && item.id === trackId) {
      return { ...item, duration };
    }
    if (isProjectGroup(item)) {
      return { ...item, items: updateTrackInItems(item.items, trackId, duration) };
    }
    return item;
  });
}

export const updateTrackLoudnessInItems = (
  items: ProjectItem[],
  trackId: string,
  loudness: TrackLoudness,
): ProjectItem[] => {
  return items.map((item) => {
    if (isProjectTrack(item) && item.id === trackId) {
      return { ...item, loudness };
    }
    if (isProjectGroup(item)) {
      return { ...item, items: updateTrackLoudnessInItems(item.items, trackId, loudness) };
    }
    return item;
  });
}

export const markTrackMissingInItems = (
  items: ProjectItem[],
  trackId: string,
  isMissing = true,
): ProjectItem[] => {
  return items.map((item) => {
    if (isProjectTrack(item) && item.id === trackId) {
      return { ...item, isMissing };
    }
    if (isProjectGroup(item)) {
      return { ...item, items: markTrackMissingInItems(item.items, trackId, isMissing) };
    }
    return item;
  });
}

export const updateGroupInItems = (
  items: ProjectItem[],
  groupId: string,
  updater: (group: ProjectGroup) => ProjectGroup,
): ProjectItem[] => {
  return items.map((item) => {
    if (isProjectGroup(item) && item.id === groupId) {
      return updater(item);
    }
    if (isProjectGroup(item)) {
      return {
        ...item,
        items: updateGroupInItems(item.items, groupId, updater),
      };
    }
    return item;
  });
}

export const insertItemAtPath = (
  items: ProjectItem[],
  item: ProjectItem,
  parentPath: string[],
  index: number,
): ProjectItem[] => {
  if (parentPath.length === 0) {
    const newItems = [...items];
    newItems.splice(index, 0, item);
    return newItems;
  }

  const [parentId, ...restPath] = parentPath;
  return items.map((existingItem) => {
    if (isProjectGroup(existingItem) && existingItem.id === parentId) {
      if (restPath.length === 0) {
        const newGroupItems = [...existingItem.items];
        newGroupItems.splice(index, 0, item);
        return { ...existingItem, items: newGroupItems };
      } else {
        return {
          ...existingItem,
          items: insertItemAtPath(existingItem.items, item, restPath, index),
        };
      }
    }
    if (isProjectGroup(existingItem)) {
      return {
        ...existingItem,
        items: insertItemAtPath(existingItem.items, item, parentPath, index),
      };
    }
    return existingItem;
  });
}

export const removeItemAtPath = (
  items: ProjectItem[],
  parentPath: string[],
  index: number,
): ProjectItem[] => {
  if (parentPath.length === 0) {
    const newItems = [...items];
    if (index >= 0 && index < newItems.length) {
      newItems.splice(index, 1);
    }
    return newItems;
  }

  const [parentId, ...restPath] = parentPath;
  return items.map((existingItem) => {
    if (isProjectGroup(existingItem) && existingItem.id === parentId) {
      if (restPath.length === 0) {
        const newGroupItems = [...existingItem.items];
        if (index >= 0 && index < newGroupItems.length) {
          newGroupItems.splice(index, 1);
        }
        return { ...existingItem, items: newGroupItems };
      } else {
        return {
          ...existingItem,
          items: removeItemAtPath(existingItem.items, restPath, index),
        };
      }
    }
    if (isProjectGroup(existingItem)) {
      return {
        ...existingItem,
        items: removeItemAtPath(existingItem.items, parentPath, index),
      };
    }
    return existingItem;
  });
}

export const removeItemsById = (items: ProjectItem[], itemIds: string[]): ProjectItem[] => {
  const idsSet = new Set(itemIds);
  return items
    .filter((item) => !idsSet.has(item.id))
    .map((item) => {
      if (isProjectGroup(item)) {
        return {
          ...item,
          items: removeItemsById(item.items, itemIds),
        };
      }
      return item;
    });
}

export const collectItemsById = (items: ProjectItem[], itemIds: string[]): ProjectItem[] => {
  const result: ProjectItem[] = [];
  const foundItems = new Map<string, ProjectItem>();

  const collectRecursive = (itemsToCollect: ProjectItem[]): void => {
    for (const item of itemsToCollect) {
      if (itemIds.includes(item.id)) {
        foundItems.set(item.id, item);
      }
      if (isProjectGroup(item)) {
        collectRecursive(item.items);
      }
    }
  };

  collectRecursive(items);

  for (const id of itemIds) {
    const item = foundItems.get(id);
    if (item) {
      result.push(item);
    }
  }

  return result;
}

export const insertIntoGroup = (
  items: ProjectItem[],
  groupId: string,
  index: number,
  itemsToInsert: ProjectItem[],
): ProjectItem[] => {
  return items.map((item) => {
    if (isProjectGroup(item) && item.id === groupId) {
      const newGroupItems = [...item.items];
      const safeIndex = Math.min(Math.max(0, index), newGroupItems.length);
      newGroupItems.splice(safeIndex, 0, ...itemsToInsert);
      return { ...item, items: newGroupItems };
    }
    if (isProjectGroup(item)) {
      return {
        ...item,
        items: insertIntoGroup(item.items, groupId, index, itemsToInsert),
      };
    }
    return item;
  });
}
