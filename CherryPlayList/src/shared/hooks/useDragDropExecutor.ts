import { isProjectGroup, ProjectItem } from '@core/types/project';
import { useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';


import { DragDropCommand } from '../../modules/dragDrop/types';
import {
  AddItemsAtPositionsCommand,
  ItemPosition,
  RemoveItemsAtPositionsCommand,
} from '../commands';
import {
  useGlobalHistoryStore,
  createMoveDescription,
  createCopyDescription,
} from '../stores/globalHistoryStore';
import {
  findItemRecursive,
  findItemWithParent,
  removeItemsById,
  insertIntoGroup,
} from '../stores/projectStoreCore';
import { getProjectStore } from '../stores/projectStoreFactory';
import { cloneItems } from '../utils/historyCore';
import { logger } from '../utils/logger';

const cloneItemWithNewIds = (item: ProjectItem): ProjectItem => {
  if (isProjectGroup(item)) {
    return {
      ...item,
      id: uuidv4(),
      items: item.items.map(cloneItemWithNewIds),
    };
  }
  return { ...item, id: uuidv4() };
};

const insertItemsAtPosition = (
  items: ProjectItem[],
  itemsToInsert: ProjectItem[],
  parentId: string | null,
  localIndex: number,
): ProjectItem[] => {
  if (parentId === null) {
    const newItems = [...items];
    const safeIndex = Math.min(Math.max(0, localIndex), newItems.length);
    newItems.splice(safeIndex, 0, ...itemsToInsert);
    return newItems;
  } else {
    return insertIntoGroup(items, parentId, localIndex, itemsToInsert);
  }
};

export const useDragDropExecutor = () => {
  const executeMove = useCallback((command: DragDropCommand): boolean => {
    if (command.type !== 'move') {
      logger.error('executeMove: invalid command type', { type: command.type });
      return false;
    }

    try {
      const { itemIds, sourceWorkspaceId, targetWorkspaceId, targetParentId, targetIndex } =
        command;
      const isSameWorkspace = sourceWorkspaceId === targetWorkspaceId;

      const sourceStore = getProjectStore(sourceWorkspaceId);
      const targetStore = getProjectStore(targetWorkspaceId);

      if (!sourceStore || !targetStore) {
        logger.error('executeMove: stores not found', {
          sourceWorkspaceId,
          targetWorkspaceId,
        });
        return false;
      }

      const sourceState = sourceStore.getState();

      const itemsToMove: ProjectItem[] = [];
      const sourcePositions: ItemPosition[] = [];
      for (const id of itemIds) {
        const positionInfo = findItemWithParent(sourceState.items, id);
        if (positionInfo) {
          itemsToMove.push(positionInfo.item);
          sourcePositions.push({
            item: positionInfo.item,
            parentPath: positionInfo.parentPath,
            index: positionInfo.indexInParent,
          });
        }
      }

      if (itemsToMove.length === 0) {
        logger.warn('executeMove: no items found to move', { itemIds });
        return false;
      }

      const newItems: ProjectItem[] = isSameWorkspace
        ? cloneItems(itemsToMove)
        : itemsToMove.map(cloneItemWithNewIds);

      const sourceItemsBefore = [...sourceState.items];
      const targetItemsBefore = isSameWorkspace
        ? sourceItemsBefore
        : [...targetStore.getState().items];

      try {
        sourceStore.setState({ _skipHistory: true });
        if (!isSameWorkspace) {
          targetStore.setState({ _skipHistory: true });
        }

        const sourceNewItems = removeItemsById(sourceState.items, itemIds);
        sourceStore.setState({ items: sourceNewItems });

        const currentTargetItems = isSameWorkspace
          ? sourceStore.getState().items
          : targetStore.getState().items;

        const targetNewItems = insertItemsAtPosition(
          currentTargetItems,
          newItems,
          targetParentId,
          targetIndex,
        );

        if (isSameWorkspace) {
          sourceStore.setState({ items: targetNewItems, _skipHistory: false });
        } else {
          targetStore.setState({ items: targetNewItems, _skipHistory: false });
        }

        const targetParentPath = targetParentId ? [targetParentId] : [];
        const targetPositions: ItemPosition[] = newItems.map((item, i) => ({
          item,
          parentPath: targetParentPath,
          index: targetIndex + i,
        }));

        useGlobalHistoryStore.getState().pushCompositeCommand(
          [
            {
              workspaceId: sourceWorkspaceId,
              command: new RemoveItemsAtPositionsCommand(
                sourcePositions.map((p) => ({
                  item: cloneItems([p.item])[0],
                  parentPath: p.parentPath,
                  index: p.index,
                })),
              ),
            },
            {
              workspaceId: targetWorkspaceId,
              command: new AddItemsAtPositionsCommand(
                targetPositions.map((p) => ({
                  item: cloneItems([p.item])[0],
                  parentPath: p.parentPath,
                  index: p.index,
                })),
              ),
            },
          ],
          createMoveDescription(sourceWorkspaceId, targetWorkspaceId, itemsToMove.length),
        );

        sourceStore.getState().markAsDirty();
        if (!isSameWorkspace) {
          targetStore.getState().markAsDirty();
        }

        return true;
      } catch (error) {
        logger.error('executeMove: error during transaction, rolling back', error);
        try {
          sourceStore.setState({ items: sourceItemsBefore, _skipHistory: false });
          if (!isSameWorkspace) {
            targetStore.setState({ items: targetItemsBefore, _skipHistory: false });
          }
        } catch (rollbackError) {
          logger.error('executeMove: rollback failed', rollbackError);
        }
        return false;
      }
    } catch (error) {
      logger.error('executeMove: unexpected error', error);
      return false;
    }
  }, []);

  const executeCopy = useCallback((command: DragDropCommand): boolean => {
    if (command.type !== 'copy') {
      logger.error('executeCopy: invalid command type', { type: command.type });
      return false;
    }

    try {
      const { itemIds, sourceWorkspaceId, targetWorkspaceId, targetParentId, targetIndex } =
        command;

      const sourceStore = getProjectStore(sourceWorkspaceId);
      const targetStore = getProjectStore(targetWorkspaceId);

      if (!sourceStore || !targetStore) {
        logger.error('executeCopy: stores not found', {
          sourceWorkspaceId,
          targetWorkspaceId,
        });
        return false;
      }

      const sourceState = sourceStore.getState();

      const itemsToCopy: ProjectItem[] = [];
      for (const id of itemIds) {
        const item = findItemRecursive(sourceState.items, id);
        if (item) {
          itemsToCopy.push(item);
        }
      }

      if (itemsToCopy.length === 0) {
        logger.warn('executeCopy: no items found to copy', { itemIds });
        return false;
      }

      const newItems: ProjectItem[] = itemsToCopy.map(cloneItemWithNewIds);

      const targetState = targetStore.getState();

      targetStore.setState({ _skipHistory: true });

      const targetNewItems = insertItemsAtPosition(
        targetState.items,
        newItems,
        targetParentId,
        targetIndex,
      );
      targetStore.setState({ items: targetNewItems, _skipHistory: false });

      const targetParentPath = targetParentId ? [targetParentId] : [];
      const targetPositions: ItemPosition[] = newItems.map((item, i) => ({
        item,
        parentPath: targetParentPath,
        index: targetIndex + i,
      }));

      useGlobalHistoryStore.getState().pushCommand(
        targetWorkspaceId,
        new AddItemsAtPositionsCommand(
          targetPositions.map((p) => ({
            item: cloneItems([p.item])[0],
            parentPath: p.parentPath,
            index: p.index,
          })),
        ),
        createCopyDescription(sourceWorkspaceId, targetWorkspaceId, itemsToCopy.length),
      );

      targetStore.getState().markAsDirty();

      return true;
    } catch (error) {
      logger.error('executeCopy: unexpected error', error);
      return false;
    }
  }, []);

  return { executeMove, executeCopy };
};
