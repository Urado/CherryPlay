import { createWithEqualityFn } from 'zustand/traditional';

import { ProjectItem } from '@core/types/project';
import { WorkspaceId } from '@core/types/workspace';

import { DraggedItems, DragDropResult, ItemDragState } from '../../modules/dragDrop/types';
import { logger } from '../utils/logger';

import { findItemRecursive } from './projectStoreCore';
import { getProjectStore, getAllProjectStoreIds, ProjectStoreState } from './projectStoreFactory';

interface DragDropState {
  dragging: boolean;
  draggedItems: DraggedItems;
  hoverWorkspaceId: WorkspaceId | null;

  setDragging: (dragging: boolean) => void;
  setDraggedItems: (items: DraggedItems | ((current: DraggedItems) => DraggedItems)) => void;
  setHoverWorkspaceId: (workspaceId: WorkspaceId | null) => void;
  clearDragState: () => void;

  prepareMoveCommand: (
    itemIds: string[],
    sourceWorkspaceId: WorkspaceId,
    targetWorkspaceId: WorkspaceId,
    targetParentId: string | null,
    targetIndex: number,
  ) => DragDropResult;

  prepareCopyCommand: (
    itemIds: string[],
    sourceWorkspaceId: WorkspaceId,
    targetWorkspaceId: WorkspaceId,
    targetParentId: string | null,
    targetIndex: number,
  ) => DragDropResult;
}

function canAddItems(
  targetState: ProjectStoreState | { maxItems?: number | null; items: ProjectItem[] },
  count: number,
): { canAdd: boolean; availableSlots: number } {
  const maxItems = targetState.maxItems;
  if (maxItems === null || maxItems === undefined) {
    return { canAdd: true, availableSlots: count };
  }

  if (typeof maxItems !== 'number' || isNaN(maxItems)) {
    logger.warn('canAddItems: maxItems is not a valid number', { maxItems });
    return { canAdd: true, availableSlots: count };
  }

  const itemsLength = targetState.items?.length ?? 0;
  const availableSlots = maxItems - itemsLength;
  return { canAdd: availableSlots >= count, availableSlots: Math.max(0, availableSlots) };
}

export const useDragDropStore = createWithEqualityFn<DragDropState>((set) => ({
  dragging: false,
  draggedItems: null,
  hoverWorkspaceId: null,

  setDragging: (dragging) => set({ dragging }),

  setDraggedItems: (items) =>
    set((state) => ({
      draggedItems: typeof items === 'function' ? items(state.draggedItems) : items,
    })),

  setHoverWorkspaceId: (workspaceId) => set({ hoverWorkspaceId: workspaceId }),

  clearDragState: () =>
    set({
      dragging: false,
      draggedItems: null,
      hoverWorkspaceId: null,
    }),

  prepareMoveCommand: (
    itemIds: string[],
    sourceWorkspaceId: WorkspaceId,
    targetWorkspaceId: WorkspaceId,
    targetParentId: string | null,
    targetIndex: number,
  ): DragDropResult => {
    if (!itemIds || itemIds.length === 0) {
      logger.warn('prepareMoveCommand: empty itemIds array');
      return { success: false, error: 'No items selected for move' };
    }

    // Same-workspace moves are now allowed - unified with cross-workspace
    const sourceStore = getProjectStore(sourceWorkspaceId);
    const targetStore = getProjectStore(targetWorkspaceId);

    if (!sourceStore || !targetStore) {
      const registeredStores = getAllProjectStoreIds();
      logger.error('prepareMoveCommand: stores not found', {
        sourceWorkspaceId,
        targetWorkspaceId,
        registeredStores,
      });
      return { success: false, error: 'Cannot move items: workspace not found' };
    }

    const sourceState = sourceStore.getState();
    const existingItemIds = itemIds.filter((id) => {
      const item = findItemRecursive(sourceState.items, id);
      return item !== undefined && item !== null;
    });

    if (existingItemIds.length === 0) {
      logger.warn('prepareMoveCommand: no valid items found to move', {
        itemIds,
        sourceWorkspaceId,
      });
      return { success: false, error: 'No valid items found to move' };
    }

    const targetState = targetStore.getState();
    const { canAdd, availableSlots } = canAddItems(targetState, existingItemIds.length);

    if (!canAdd) {
      const message =
        availableSlots > 0
          ? `Cannot move ${existingItemIds.length} items: only ${availableSlots} slots available`
          : 'Cannot move items: target workspace is full';
      logger.warn('prepareMoveCommand: target workspace limit exceeded', {
        requested: existingItemIds.length,
        available: availableSlots,
      });
      return { success: false, error: message };
    }

    return {
      success: true,
      command: {
        type: 'move',
        itemIds: existingItemIds,
        sourceWorkspaceId,
        targetWorkspaceId,
        targetParentId,
        targetIndex,
      },
    };
  },

  prepareCopyCommand: (
    itemIds: string[],
    sourceWorkspaceId: WorkspaceId,
    targetWorkspaceId: WorkspaceId,
    targetParentId: string | null,
    targetIndex: number,
  ): DragDropResult => {
    if (!itemIds || itemIds.length === 0) {
      logger.warn('prepareCopyCommand: empty itemIds array');
      return { success: false, error: 'No items selected for copy' };
    }

    const sourceStore = getProjectStore(sourceWorkspaceId);
    const targetStore = getProjectStore(targetWorkspaceId);

    if (!sourceStore || !targetStore) {
      logger.error('prepareCopyCommand: stores not found', {
        sourceWorkspaceId,
        targetWorkspaceId,
        registeredStores: getAllProjectStoreIds(),
      });
      return { success: false, error: 'Cannot copy items: workspace not found' };
    }

    const sourceState = sourceStore.getState();
    const existingItemIds = itemIds.filter((id) => {
      const item = findItemRecursive(sourceState.items, id);
      return item !== undefined && item !== null;
    });

    if (existingItemIds.length === 0) {
      logger.warn('prepareCopyCommand: no valid items found to copy', {
        itemIds,
        sourceWorkspaceId,
      });
      return { success: false, error: 'No valid items found to copy' };
    }

    const targetState = targetStore.getState();
    const { canAdd, availableSlots } = canAddItems(targetState, existingItemIds.length);

    if (!canAdd) {
      const message =
        availableSlots > 0
          ? `Cannot copy ${existingItemIds.length} items: only ${availableSlots} slots available`
          : 'Cannot copy items: target workspace is full';
      logger.warn('prepareCopyCommand: target workspace limit exceeded', {
        requested: existingItemIds.length,
        available: availableSlots,
      });
      return { success: false, error: message };
    }

    return {
      success: true,
      command: {
        type: 'copy',
        itemIds: existingItemIds,
        sourceWorkspaceId,
        targetWorkspaceId,
        targetParentId,
        targetIndex,
      },
    };
  },
}));

export function isItemDragState(draggedItems: DraggedItems): draggedItems is ItemDragState {
  return draggedItems !== null && draggedItems.type === 'items';
}
