import { isProjectGroup } from '@core/types/project';

import { DisplayItem } from '../../shared/utils/playerItemsUtils';

import { HierarchyPosition, InsertPosition } from './types';

export function collectFlatIndicesForItem(itemId: string, displayItems: DisplayItem[]): Set<number> {
  const indices = new Set<number>();

  const itemIndex = displayItems.findIndex((di) => di.item.id === itemId);
  if (itemIndex === -1) {
    return indices;
  }

  const item = displayItems[itemIndex];
  indices.add(item.flatIndex);

  if (isProjectGroup(item.item)) {
    const groupLevel = item.level;
    for (let i = itemIndex + 1; i < displayItems.length; i++) {
      const di = displayItems[i];
      if (di.level <= groupLevel) {
        break;
      }
      indices.add(di.flatIndex);
    }
  }

  return indices;
}

export function collectAllFlatIndices(rootIds: string[], displayItems: DisplayItem[]): Set<number> {
  const allIndices = new Set<number>();

  for (const id of rootIds) {
    const indices = collectFlatIndicesForItem(id, displayItems);
    indices.forEach((idx) => allIndices.add(idx));
  }

  return allIndices;
}

export function getRootIdsForDrag(
  itemId: string,
  selectedIds: Set<string>,
  displayItems: DisplayItem[],
): string[] {
  const idsToProcess = selectedIds.has(itemId) && selectedIds.size > 1
    ? selectedIds
    : new Set([itemId]);

  const allIndicesMap = new Map<string, Set<number>>();
  for (const id of idsToProcess) {
    allIndicesMap.set(id, collectFlatIndicesForItem(id, displayItems));
  }

  const rootIds: string[] = [];
  for (const id of idsToProcess) {
    const itemDi = displayItems.find((di) => di.item.id === id);
    if (!itemDi) continue;

    let isNested = false;
    for (const [otherId, otherIndices] of allIndicesMap) {
      if (otherId === id) continue;
      if (otherIndices.has(itemDi.flatIndex)) {
        isNested = true;
        break;
      }
    }

    if (!isNested) {
      rootIds.push(id);
    }
  }

  return rootIds.sort((a, b) => {
    const aIdx = displayItems.find((di) => di.item.id === a)?.flatIndex ?? 0;
    const bIdx = displayItems.find((di) => di.item.id === b)?.flatIndex ?? 0;
    return aIdx - bIdx;
  });
}

export function isDropInsideDragged(targetFlatIndex: number, allFlatIndices: Set<number>): boolean {
  return allFlatIndices.has(targetFlatIndex);
}

export function calculateDropPosition(
  targetFlatIndex: number,
  position: InsertPosition,
  displayItems: DisplayItem[],
): HierarchyPosition {
  const targetItem = displayItems[targetFlatIndex];
  if (!targetItem) {
    const rootCount = displayItems.filter((di) => di.parentGroupId === null).length;
    return { parentId: null, localIndex: rootCount };
  }

  if (position === 'top') {
    const parentId = targetItem.parentGroupId;
    const siblings = displayItems.filter((di) => di.parentGroupId === parentId);
    const localIndex = siblings.findIndex((di) => di.flatIndex === targetFlatIndex);
    return {
      parentId,
      localIndex: localIndex === -1 ? 0 : localIndex,
    };
  }

  if (isProjectGroup(targetItem.item)) {
    return { parentId: targetItem.item.id, localIndex: 0 };
  }

  const nextFlatIndex = targetFlatIndex + 1;
  const nextItem = displayItems[nextFlatIndex];

  if (!nextItem) {
    if (targetItem.parentGroupId !== null) {
      const siblings = displayItems.filter((di) => di.parentGroupId === targetItem.parentGroupId);
      return { parentId: targetItem.parentGroupId, localIndex: siblings.length };
    }
    const rootCount = displayItems.filter((di) => di.parentGroupId === null).length;
    return { parentId: null, localIndex: rootCount };
  }

  if (targetItem.parentGroupId !== null && nextItem.level <= targetItem.level) {
    const siblings = displayItems.filter((di) => di.parentGroupId === targetItem.parentGroupId);
    const targetSiblingIndex = siblings.findIndex((di) => di.flatIndex === targetFlatIndex);
    return { parentId: targetItem.parentGroupId, localIndex: targetSiblingIndex + 1 };
  }

  const parentId = nextItem.parentGroupId;
  const siblings = displayItems.filter((di) => di.parentGroupId === parentId);
  const localIndex = siblings.findIndex((di) => di.flatIndex === nextFlatIndex);

  return {
    parentId,
    localIndex: localIndex === -1 ? 0 : localIndex,
  };
}

export function filterDisplayItems(
  displayItems: DisplayItem[],
  indicesToRemove: Set<number>,
): DisplayItem[] {
  const filtered: DisplayItem[] = [];
  let newFlatIndex = 0;

  for (const di of displayItems) {
    if (!indicesToRemove.has(di.flatIndex)) {
      filtered.push({
        ...di,
        flatIndex: newFlatIndex++,
      });
    }
  }

  return filtered;
}
