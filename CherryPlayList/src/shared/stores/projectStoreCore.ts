import { isProjectGroup, isProjectTrack, ProjectGroup, ProjectItem } from '@core/types/project';
import { Track } from '@core/types/track';

export interface ItemPositionInfo {
  item: ProjectItem;
  parentPath: string[];
  indexInParent: number;
}

export interface FlatListItem {
  item: ProjectItem;
  path: string[];
}

export function findItemRecursive(items: ProjectItem[], id: string): ProjectItem | null {
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

export function getItemPathRecursive(
  items: ProjectItem[],
  itemId: string,
  currentPath: string[] = [],
): string[] | null {
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

export function findItemWithParent(items: ProjectItem[], itemId: string): ItemPositionInfo | null {
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

export function getAllTracksRecursive(items: ProjectItem[]): Track[] {
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

export function getFlatItemList(items: ProjectItem[]): FlatListItem[] {
  const result: FlatListItem[] = [];

  function traverse(itemsToTraverse: ProjectItem[], currentPath: string[]) {
    for (const item of itemsToTraverse) {
      const itemPath = [...currentPath, item.id];
      result.push({ item, path: itemPath });
      if (isProjectGroup(item)) {
        traverse(item.items, itemPath);
      }
    }
  }

  traverse(items, []);
  return result;
}

export function collectAllItemIds(item: ProjectItem): string[] {
  const ids = [item.id];
  if (isProjectGroup(item)) {
    for (const child of item.items) {
      ids.push(...collectAllItemIds(child));
    }
  }
  return ids;
}

export function removeItemFromItems(items: ProjectItem[], itemId: string): ProjectItem[] {
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

export function updateTrackInItems(
  items: ProjectItem[],
  trackId: string,
  duration: number,
): ProjectItem[] {
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

export function markTrackMissingInItems(
  items: ProjectItem[],
  trackId: string,
  isMissing = true,
): ProjectItem[] {
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

export function updateGroupInItems(
  items: ProjectItem[],
  groupId: string,
  updater: (group: ProjectGroup) => ProjectGroup,
): ProjectItem[] {
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

export function insertItemAtPath(
  items: ProjectItem[],
  item: ProjectItem,
  parentPath: string[],
  index: number,
): ProjectItem[] {
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

export function removeItemAtPath(
  items: ProjectItem[],
  parentPath: string[],
  index: number,
): ProjectItem[] {
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

/**
 * Удаляет несколько элементов по их ID из иерархии
 * @param items - Текущая иерархия элементов
 * @param itemIds - Массив ID элементов для удаления
 * @returns Новая иерархия без указанных элементов
 */
export function removeItemsById(items: ProjectItem[], itemIds: string[]): ProjectItem[] {
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

/**
 * Собирает элементы по их ID из иерархии, сохраняя порядок из flatList
 * @param items - Иерархия элементов
 * @param itemIds - Массив ID элементов для сбора (в нужном порядке)
 * @returns Массив найденных элементов в порядке itemIds
 */
export function collectItemsById(items: ProjectItem[], itemIds: string[]): ProjectItem[] {
  const result: ProjectItem[] = [];
  const foundItems = new Map<string, ProjectItem>();

  // Рекурсивно собираем все элементы в Map
  function collectRecursive(itemsToCollect: ProjectItem[]) {
    for (const item of itemsToCollect) {
      if (itemIds.includes(item.id)) {
        foundItems.set(item.id, item);
      }
      if (isProjectGroup(item)) {
        collectRecursive(item.items);
      }
    }
  }

  collectRecursive(items);

  // Возвращаем элементы в порядке itemIds
  for (const id of itemIds) {
    const item = foundItems.get(id);
    if (item) {
      result.push(item);
    }
  }

  return result;
}

/**
 * Вставляет элементы в группу по её ID
 * @param items - Текущая иерархия элементов
 * @param groupId - ID группы для вставки
 * @param index - Индекс вставки внутри группы
 * @param itemsToInsert - Элементы для вставки
 * @returns Новая иерархия с вставленными элементами
 */
export function insertIntoGroup(
  items: ProjectItem[],
  groupId: string,
  index: number,
  itemsToInsert: ProjectItem[],
): ProjectItem[] {
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
