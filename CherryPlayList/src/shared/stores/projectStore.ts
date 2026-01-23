import { v4 as uuidv4 } from 'uuid';
import { persist } from 'zustand/middleware';
import { createWithEqualityFn } from 'zustand/traditional';

import {
  ActionAfterTrack,
  DEFAULT_PROJECT_META,
  DEFAULT_PROJECT_SETTINGS,
  DEFAULT_SESSION_STATE,
  isProjectGroup,
  ProjectGroup,
  ProjectGroupSettings,
  ProjectItem,
  ProjectMeta,
  ProjectSessionMode,
  ProjectSessionState,
  ProjectSettings,
  ProjectTrackSettings,
} from '@core/types/project';
import { Track } from '@core/types/track';
import { DEFAULT_PLAYLIST_WORKSPACE_ID } from '@core/constants/workspace';

import {
  HistoryCommand,
  ItemsState,
  AddItemsCommand,
  RemoveItemsCommand,
  RemoveNestedItemCommand,
  MoveItemCommand,
  MoveItemsCommand,
  CreateGroupCommand,
  UngroupCommand,
  RenameGroupCommand,
  SetNameCommand,
} from '../commands';
import { electronStorage } from '../storage/electronStorage';
import { cloneItem, cloneItems } from '../utils/historyCore';

import { useGlobalHistoryStore } from './globalHistoryStore';
import { registerExternalApplyHandler, registerProjectStore } from './projectStoreFactory';
import {
  findItemRecursive,
  getAllTracksRecursive,
  getItemPathRecursive,
  getFlatItemList,
  removeItemFromItems,
  updateTrackInItems,
  updateGroupInItems,
  collectAllItemIds,
  findItemWithParent,
  removeItemsById,
  collectItemsById,
  insertIntoGroup,
} from './projectStoreCore';

const PROJECT_WORKSPACE_ID = DEFAULT_PLAYLIST_WORKSPACE_ID;

interface ProjectState {
  name: string;
  items: ProjectItem[];
  settings: ProjectSettings;
  trackSettings: Map<string, ProjectTrackSettings>;
  groupSettings: Map<string, ProjectGroupSettings>;
  sessionState: ProjectSessionState;
  meta: ProjectMeta;
  selectedItemIds: Set<string>;
  _skipHistory: boolean;

  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  _applyCommand: (command: HistoryCommand, mode: 'execute' | 'undo') => boolean;

  setName: (name: string) => void;
  newProject: () => void;
  loadProject: (data: {
    name: string;
    items: ProjectItem[];
    settings: ProjectSettings;
    trackSettings: Map<string, ProjectTrackSettings>;
    groupSettings: Map<string, ProjectGroupSettings>;
    sessionState?: ProjectSessionState;
    filePath?: string;
  }) => void;
  setFilePath: (path: string | null) => void;
  markAsDirty: () => void;
  resetDirty: () => void;

  addItem: (item: Omit<Track, 'id'>, index?: number) => void;
  addItems: (items: Omit<Track, 'id'>[], index?: number) => void;
  removeItem: (id: string) => void;
  moveItem: (fromIndex: number, toIndex: number) => void;
  findItemById: (id: string) => ProjectItem | null;
  findItemIndex: (id: string) => number;
  getAllTracksInOrder: (items?: ProjectItem[]) => Track[];
  getItemPath: (itemId: string) => string[];
  updateTrackDuration: (id: string, duration: number) => void;

  createGroup: (itemIds: string[], name?: string) => string;
  ungroupGroup: (groupId: string) => void;
  removeGroup: (groupId: string) => void;
  setGroupName: (groupId: string, name: string) => void;
  addItemToGroup: (groupId: string, itemId: string, index?: number) => void;
  removeItemFromGroup: (groupId: string, itemId: string) => void;
  moveItemInGroup: (groupId: string, fromIndex: number, toIndex: number) => void;

  selectItem: (id: string) => void;
  deselectItem: (id: string) => void;
  toggleItemSelection: (id: string) => void;
  selectAll: () => void;
  deselectAll: () => void;
  removeSelectedItems: () => void;
  moveSelectedItems: (toIndex: number) => void;
  selectRange: (fromId: string, toId: string) => void;
  moveItemsToContext: (
    itemIds: string[],
    targetParentId: string | null,
    targetIndex: number,
  ) => void;

  setDefaultPauseBetweenTracks: (value: number) => void;
  setDefaultActionAfterTrack: (value: ActionAfterTrack) => void;
  setPlannedEndTime: (time: number | null) => void;
  setTrackSettings: (trackId: string, settings: ProjectTrackSettings) => void;
  getTrackSettings: (trackId: string) => ProjectTrackSettings;
  clearTrackSettings: (trackId: string) => void;
  setGroupSettings: (groupId: string, settings: ProjectGroupSettings) => void;
  getGroupSettings: (groupId: string) => ProjectGroupSettings;
  clearGroupSettings: (groupId: string) => void;

  startSession: () => void;
  resetSession: () => void;
  markTrackAsPlayed: (trackId: string) => void;
  setCurrentTrack: (trackId: string | null) => void;
  isTrackPlayed: (trackId: string) => boolean;
  toggleTrackDisabled: (trackId: string) => void;
  isTrackDisabled: (trackId: string) => boolean;
  toggleGroupDisabled: (groupId: string) => void;
  isGroupDisabled: (groupId: string) => boolean;
}

export const useProjectStore = createWithEqualityFn<ProjectState>()(
  persist(
    (set, get) => ({
      name: 'New Project',
      items: [],
      settings: { ...DEFAULT_PROJECT_SETTINGS },
      trackSettings: new Map(),
      groupSettings: new Map(),
      sessionState: { ...DEFAULT_SESSION_STATE },
      meta: { ...DEFAULT_PROJECT_META },
      selectedItemIds: new Set<string>(),
      _skipHistory: false,

      undo: () => {
        useGlobalHistoryStore.getState().undo();
      },

      redo: () => {
        useGlobalHistoryStore.getState().redo();
      },

      canUndo: () => {
        return useGlobalHistoryStore.getState().canUndo();
      },

      canRedo: () => {
        return useGlobalHistoryStore.getState().canRedo();
      },

      _applyCommand: (command, mode) => {
        const state = get();
        set({ _skipHistory: true });

        try {
          const currentState: ItemsState = { items: state.items, name: state.name };
          const result = mode === 'execute' ? command.execute(currentState) : command.undo(currentState);

          if (result.success && result.newState) {
            set(result.newState);
            get().markAsDirty();
            return true;
          }
          return false;
        } finally {
          set({ _skipHistory: false });
        }
      },

      setName: (name) => {
        const state = get();
        const oldName = state.name;
        if (oldName === name) return;

        set({ name });

        if (!state._skipHistory) {
          useGlobalHistoryStore.getState().pushCommand(
            PROJECT_WORKSPACE_ID,
            new SetNameCommand(oldName, name),
            `Rename project to "${name}"`,
          );
        }

        get().markAsDirty();
      },

      newProject: () => {
        set({
          name: 'New Project',
          items: [],
          settings: { ...DEFAULT_PROJECT_SETTINGS },
          trackSettings: new Map(),
          groupSettings: new Map(),
          sessionState: { ...DEFAULT_SESSION_STATE },
          meta: { ...DEFAULT_PROJECT_META },
          selectedItemIds: new Set(),
          _skipHistory: false,
        });
        useGlobalHistoryStore.getState().clearHistory();
      },

      loadProject: (data) => {
        set({
          name: data.name,
          items: data.items,
          settings: data.settings,
          trackSettings: data.trackSettings,
          groupSettings: data.groupSettings,
          sessionState: data.sessionState || { ...DEFAULT_SESSION_STATE },
          meta: {
            filePath: data.filePath || null,
            isDirty: false,
            lastSavedAt: Date.now(),
          },
          selectedItemIds: new Set(),
          _skipHistory: false,
        });
        useGlobalHistoryStore.getState().clearHistory();
      },

      setFilePath: (path) => {
        set((state) => ({
          meta: { ...state.meta, filePath: path },
        }));
      },

      markAsDirty: () => {
        set((state) => ({
          meta: { ...state.meta, isDirty: true },
        }));
      },

      resetDirty: () => {
        set((state) => ({
          meta: { ...state.meta, isDirty: false, lastSavedAt: Date.now() },
        }));
      },

      addItem: (item, index) => {
        const state = get();
        const newItem: Track = { ...item, id: uuidv4() };
        const insertIndex = index ?? state.items.length;

        set((s) => {
          const newItems = [...s.items];
          newItems.splice(insertIndex, 0, newItem);
          return { items: newItems };
        });

        if (!state._skipHistory) {
          useGlobalHistoryStore.getState().pushCommand(
            PROJECT_WORKSPACE_ID,
            new AddItemsCommand([cloneItem(newItem)], insertIndex),
            `Add "${newItem.name}"`,
          );
        }

        get().markAsDirty();
      },

      addItems: (items, index) => {
        const state = get();
        const itemsWithIds: Track[] = items.map((item) => ({ ...item, id: uuidv4() }));
        const insertIndex = index ?? state.items.length;

        set((s) => {
          const newItems = [...s.items];
          newItems.splice(insertIndex, 0, ...itemsWithIds);
          return { items: newItems };
        });

        if (!state._skipHistory) {
          useGlobalHistoryStore.getState().pushCommand(
            PROJECT_WORKSPACE_ID,
            new AddItemsCommand(cloneItems(itemsWithIds), insertIndex),
            `Add ${itemsWithIds.length} items`,
          );
        }

        get().markAsDirty();
      },

      removeItem: (id) => {
        const state = get();
        const itemInfo = findItemWithParent(state.items, id);

        if (!itemInfo) return;

        const { item: itemToRemove, parentPath, indexInParent } = itemInfo;
        const allIdsToClean = collectAllItemIds(itemToRemove);

        set((s) => {
          const newItems = removeItemFromItems(s.items, id);
          const newTrackSettings = new Map(s.trackSettings);
          const newGroupSettings = new Map(s.groupSettings);
          allIdsToClean.forEach((itemId) => {
            newTrackSettings.delete(itemId);
            newGroupSettings.delete(itemId);
          });

          const newPlayedTrackIds = s.sessionState.playedTrackIds.filter(
            (trackId) => !allIdsToClean.includes(trackId),
          );
          const newDisabledTrackIds = s.sessionState.disabledTrackIds.filter(
            (trackId) => !allIdsToClean.includes(trackId),
          );
          const newDisabledGroupIds = s.sessionState.disabledGroupIds.filter(
            (groupId) => !allIdsToClean.includes(groupId),
          );

          const newSelectedIds = new Set(
            [...s.selectedItemIds].filter((selectedId) => !allIdsToClean.includes(selectedId)),
          );

          return {
            items: newItems,
            selectedItemIds: newSelectedIds,
            trackSettings: newTrackSettings,
            groupSettings: newGroupSettings,
            sessionState: {
              ...s.sessionState,
              playedTrackIds: newPlayedTrackIds,
              disabledTrackIds: newDisabledTrackIds,
              disabledGroupIds: newDisabledGroupIds,
            },
          };
        });

        if (!state._skipHistory) {
          useGlobalHistoryStore.getState().pushCommand(
            PROJECT_WORKSPACE_ID,
            new RemoveNestedItemCommand(cloneItem(itemToRemove), parentPath, indexInParent),
            `Remove item`,
          );
        }

        get().markAsDirty();
      },

      moveItem: (fromIndex, toIndex) => {
        if (fromIndex === toIndex) return;
        const state = get();

        if (fromIndex < 0 || fromIndex >= state.items.length) {
          console.warn('moveItem: invalid fromIndex', { fromIndex, length: state.items.length });
          return;
        }
        if (toIndex < 0) {
          console.warn('moveItem: invalid toIndex', { toIndex });
          return;
        }

        set((s) => {
          const newItems = [...s.items];
          const [moved] = newItems.splice(fromIndex, 1);
          const targetIndex = Math.min(toIndex, newItems.length);
          newItems.splice(targetIndex, 0, moved);
          return { items: newItems };
        });

        if (!state._skipHistory) {
          useGlobalHistoryStore.getState().pushCommand(
            PROJECT_WORKSPACE_ID,
            new MoveItemCommand(fromIndex, toIndex),
            `Move item`,
          );
        }

        get().markAsDirty();
      },

      findItemById: (id) => {
        return findItemRecursive(get().items, id);
      },

      findItemIndex: (id) => {
        return get().items.findIndex((item) => item.id === id);
      },

      getAllTracksInOrder: (items) => {
        return getAllTracksRecursive(items || get().items);
      },

      getItemPath: (itemId) => {
        return getItemPathRecursive(get().items, itemId) || [];
      },

      updateTrackDuration: (id, duration) => {
        set((state) => ({
          items: updateTrackInItems(state.items, id, duration),
        }));
      },

      createGroup: (itemIds, name) => {
        const state = get();
        if (itemIds.length === 0) {
          throw new Error('No items to group');
        }

        const itemPaths = itemIds.map((id) => ({
          id,
          path: getItemPathRecursive(state.items, id) || [],
        }));

        const firstPath = itemPaths[0].path;
        const parentId = firstPath.length > 1 ? firstPath[firstPath.length - 2] : null;

        for (let i = 1; i < itemPaths.length; i++) {
          const currentPath = itemPaths[i].path;
          const currentParentId =
            currentPath.length > 1 ? currentPath[currentPath.length - 2] : null;
          if (currentParentId !== parentId) {
            throw new Error('Items must be in the same container to create a group');
          }
        }

        const itemsToGroup: ProjectItem[] = [];
        const itemIndices: number[] = [];
        let parentContainer: ProjectItem[] | null = null;

        const findItemsInContainer = (container: ProjectItem[]): void => {
          parentContainer = container;
          itemIds.forEach((id) => {
            const index = container.findIndex((item) => item.id === id);
            if (index !== -1) {
              itemsToGroup.push(container[index]);
              itemIndices.push(index);
            }
          });
        };

        if (parentId === null) {
          findItemsInContainer(state.items);
        } else {
          const parentGroup = findItemRecursive(state.items, parentId);
          if (!parentGroup || !isProjectGroup(parentGroup)) {
            throw new Error('Parent group not found');
          }
          findItemsInContainer(parentGroup.items);
        }

        if (itemsToGroup.length === 0 || parentContainer === null) {
          throw new Error('No items to group');
        }

        const sortedIndices = [...itemIndices].sort((a, b) => a - b);
        for (let i = 1; i < sortedIndices.length; i++) {
          if (sortedIndices[i] !== sortedIndices[i - 1] + 1) {
            throw new Error('Items must be consecutive to create a group');
          }
        }

        const itemsWithIndices = itemsToGroup.map((item, idx) => ({
          item,
          index: itemIndices[idx],
        }));
        itemsWithIndices.sort((a, b) => a.index - b.index);
        const sortedItemsToGroup = itemsWithIndices.map(({ item }) => item);

        const groupId = uuidv4();
        const groupName = name || `Group ${sortedItemsToGroup.length}`;
        const group: ProjectGroup = {
          id: groupId,
          name: groupName,
          items: sortedItemsToGroup,
        };

        const insertIndex = Math.min(...itemIndices);

        const updateContainer = (container: ProjectItem[]): ProjectItem[] => {
          const newContainer = [...container];
          const sortedIndicesDesc = [...itemIndices].sort((a, b) => b - a);
          sortedIndicesDesc.forEach((index) => {
            newContainer.splice(index, 1);
          });
          newContainer.splice(insertIndex, 0, group);
          return newContainer;
        };

        let newItems: ProjectItem[];
        if (parentId === null) {
          newItems = updateContainer(state.items);
        } else {
          newItems = updateGroupInItems(state.items, parentId, (parentGroup) => ({
            ...parentGroup,
            items: updateContainer(parentContainer!),
          }));
        }

        set({ items: newItems });

        if (!state._skipHistory && parentId === null) {
          useGlobalHistoryStore.getState().pushCommand(
            PROJECT_WORKSPACE_ID,
            new CreateGroupCommand(
              groupId,
              groupName,
              itemIds,
              insertIndex,
              cloneItems(sortedItemsToGroup),
              sortedIndices,
            ),
            `Create group "${groupName}"`,
          );
        }

        get().markAsDirty();

        return groupId;
      },

      ungroupGroup: (groupId) => {
        const state = get();
        const groupIndex = state.items.findIndex((item) => item.id === groupId);
        const groupToUngroup = groupIndex !== -1 ? state.items[groupIndex] : null;

        const ungroupRecursive = (items: ProjectItem[]): ProjectItem[] => {
          return items.flatMap((item) => {
            if (isProjectGroup(item) && item.id === groupId) {
              return item.items;
            }
            if (isProjectGroup(item)) {
              return [
                {
                  ...item,
                  items: ungroupRecursive(item.items),
                },
              ];
            }
            return [item];
          });
        };

        set((s) => ({
          items: ungroupRecursive(s.items),
        }));

        if (!state._skipHistory && groupToUngroup && isProjectGroup(groupToUngroup) && groupIndex !== -1) {
          useGlobalHistoryStore.getState().pushCommand(
            PROJECT_WORKSPACE_ID,
            new UngroupCommand(
              groupId,
              {
                id: groupToUngroup.id,
                name: groupToUngroup.name,
                items: cloneItems(groupToUngroup.items),
              },
              groupIndex,
            ),
            `Ungroup "${groupToUngroup.name}"`,
          );
        }

        get().markAsDirty();
      },

      removeGroup: (groupId) => {
        get().removeItem(groupId);
      },

      setGroupName: (groupId, name) => {
        const state = get();
        const group = findItemRecursive(state.items, groupId);
        const oldName = group && isProjectGroup(group) ? group.name : '';

        set((s) => ({
          items: updateGroupInItems(s.items, groupId, (g) => ({
            ...g,
            name,
          })),
        }));

        if (!state._skipHistory && oldName !== name) {
          useGlobalHistoryStore.getState().pushCommand(
            PROJECT_WORKSPACE_ID,
            new RenameGroupCommand(groupId, oldName, name),
            `Rename group to "${name}"`,
          );
        }

        get().markAsDirty();
      },

      addItemToGroup: (groupId, itemId, index) => {
        const state = get();
        const item = findItemRecursive(state.items, itemId);
        if (!item) return;

        const newItems = removeItemFromItems(state.items, itemId);
        const updatedItems = updateGroupInItems(newItems, groupId, (group) => {
          const newGroupItems = [...group.items];
          if (index !== undefined) {
            newGroupItems.splice(index, 0, item);
          } else {
            newGroupItems.push(item);
          }
          return { ...group, items: newGroupItems };
        });

        set({ items: updatedItems });
        get().markAsDirty();
      },

      removeItemFromGroup: (groupId, itemId) => {
        set((state) => ({
          items: updateGroupInItems(state.items, groupId, (group) => ({
            ...group,
            items: group.items.filter((item) => item.id !== itemId),
          })),
        }));
        get().markAsDirty();
      },

      moveItemInGroup: (groupId, fromIndex, toIndex) => {
        set((state) => ({
          items: updateGroupInItems(state.items, groupId, (group) => {
            const newItems = [...group.items];
            const [moved] = newItems.splice(fromIndex, 1);
            newItems.splice(toIndex, 0, moved);
            return { ...group, items: newItems };
          }),
        }));
        get().markAsDirty();
      },

      selectItem: (id) => {
        set((state) => {
          if (state.selectedItemIds.has(id)) return state;
          return { selectedItemIds: new Set([...state.selectedItemIds, id]) };
        });
      },

      deselectItem: (id) => {
        set((state) => {
          if (!state.selectedItemIds.has(id)) return state;
          const newSet = new Set(state.selectedItemIds);
          newSet.delete(id);
          return { selectedItemIds: newSet };
        });
      },

      toggleItemSelection: (id) => {
        set((state) => {
          const newSet = new Set(state.selectedItemIds);
          if (newSet.has(id)) {
            newSet.delete(id);
          } else {
            newSet.add(id);
          }
          return { selectedItemIds: newSet };
        });
      },

      selectAll: () => {
        set((state) => {
          const allIds = new Set<string>();
          const collectIds = (items: ProjectItem[]) => {
            items.forEach((item) => {
              allIds.add(item.id);
              if (isProjectGroup(item)) {
                collectIds(item.items);
              }
            });
          };
          collectIds(state.items);
          return { selectedItemIds: allIds };
        });
      },

      deselectAll: () => {
        set({ selectedItemIds: new Set() });
      },

      removeSelectedItems: () => {
        const state = get();
        const selectedIds = Array.from(state.selectedItemIds);

        const itemsToRemove: ProjectItem[] = [];
        const indicesToRemove: number[] = [];
        selectedIds.forEach((id) => {
          const index = state.items.findIndex((item) => item.id === id);
          if (index !== -1) {
            itemsToRemove.push(state.items[index]);
            indicesToRemove.push(index);
          }
        });

        let newItems = [...state.items];
        state.selectedItemIds.forEach((id) => {
          newItems = removeItemFromItems(newItems, id);
        });
        set({ items: newItems, selectedItemIds: new Set() });

        if (!state._skipHistory && itemsToRemove.length > 0) {
          useGlobalHistoryStore.getState().pushCommand(
            PROJECT_WORKSPACE_ID,
            new RemoveItemsCommand(
              cloneItems(itemsToRemove),
              indicesToRemove.sort((a, b) => a - b),
            ),
            `Remove ${itemsToRemove.length} items`,
          );
        }

        get().markAsDirty();
      },

      moveSelectedItems: (toIndex) => {
        const state = get();
        const selectedIds = Array.from(state.selectedItemIds);

        const flatList = getFlatItemList(state.items);
        const itemsWithInfo: Array<{
          item: ProjectItem;
          flatIndex: number;
          parentPath: string[];
          indexInParent: number;
        }> = [];

        selectedIds.forEach((id) => {
          const flatIndex = flatList.findIndex((x) => x.item.id === id);
          if (flatIndex !== -1) {
            const itemInfo = findItemWithParent(state.items, id);
            if (itemInfo) {
              itemsWithInfo.push({
                item: itemInfo.item,
                flatIndex,
                parentPath: itemInfo.parentPath,
                indexInParent: itemInfo.indexInParent,
              });
            }
          }
        });

        if (itemsWithInfo.length === 0) return;

        itemsWithInfo.sort((a, b) => a.flatIndex - b.flatIndex);
        const itemsToMove = itemsWithInfo.map((x) => cloneItem(x.item));

        let newItems = [...state.items];
        const sortedByFlatIndexDesc = [...itemsWithInfo].sort((a, b) => b.flatIndex - a.flatIndex);
        sortedByFlatIndexDesc.forEach((info) => {
          newItems = removeItemFromItems(newItems, info.item.id);
        });

        const insertIndex = Math.min(toIndex, newItems.length);
        newItems.splice(insertIndex, 0, ...itemsToMove);

        set({ items: newItems });

        const rootLevelItems = itemsWithInfo.filter((x) => x.parentPath.length === 0);
        if (!state._skipHistory && rootLevelItems.length > 0) {
          useGlobalHistoryStore.getState().pushCommand(
            PROJECT_WORKSPACE_ID,
            new MoveItemsCommand(
              cloneItems(rootLevelItems.map((x) => x.item)),
              rootLevelItems.map((x) => x.indexInParent),
              insertIndex,
            ),
            `Move ${rootLevelItems.length} items`,
          );
        }

        get().markAsDirty();
      },

      selectRange: (fromId, toId) => {
        const state = get();
        const flatList = getFlatItemList(state.items);
        const fromIndex = flatList.findIndex((x) => x.item.id === fromId);
        const toIndex = flatList.findIndex((x) => x.item.id === toId);

        if (fromIndex === -1 || toIndex === -1) return;

        const start = Math.min(fromIndex, toIndex);
        const end = Math.max(fromIndex, toIndex);
        const newSelected = new Set(state.selectedItemIds);

        for (let i = start; i <= end; i++) {
          newSelected.add(flatList[i].item.id);
        }

        set({ selectedItemIds: newSelected });
      },

      moveItemsToContext: (itemIds, targetParentId, targetIndex) => {
        const state = get();
        if (itemIds.length === 0) return;

        // 1. Собираем элементы для перемещения (в порядке itemIds)
        const itemsToMove = collectItemsById(state.items, itemIds);
        if (itemsToMove.length === 0) return;

        // 2. Удаляем элементы из текущих позиций
        let newItems = removeItemsById(state.items, itemIds);

        // 3. Вставляем в целевую позицию
        if (targetParentId === null) {
          // Вставка в корень
          const safeIndex = Math.min(Math.max(0, targetIndex), newItems.length);
          newItems.splice(safeIndex, 0, ...itemsToMove);
        } else {
          // Вставка в группу
          newItems = insertIntoGroup(newItems, targetParentId, targetIndex, itemsToMove);
        }

        set({ items: newItems });

        if (!state._skipHistory) {
          useGlobalHistoryStore.getState().pushCommand(
            PROJECT_WORKSPACE_ID,
            new MoveItemsCommand(
              cloneItems(itemsToMove),
              itemIds.map((id) => state.items.findIndex((item) => item.id === id)).filter((i) => i !== -1),
              targetIndex,
            ),
            `Move ${itemsToMove.length} items to ${targetParentId ? 'group' : 'root'}`,
          );
        }

        get().markAsDirty();
      },

      setDefaultPauseBetweenTracks: (value) => {
        set((state) => ({
          settings: { ...state.settings, defaultPauseBetweenTracks: value },
        }));
        get().markAsDirty();
      },

      setDefaultActionAfterTrack: (value) => {
        set((state) => ({
          settings: { ...state.settings, defaultActionAfterTrack: value },
        }));
        get().markAsDirty();
      },

      setPlannedEndTime: (time) => {
        set((state) => ({
          settings: { ...state.settings, plannedEndTime: time },
        }));
        get().markAsDirty();
      },

      setTrackSettings: (trackId, settings) => {
        set((state) => {
          const newTrackSettings = new Map(state.trackSettings);
          newTrackSettings.set(trackId, settings);
          return { trackSettings: newTrackSettings };
        });
        get().markAsDirty();
      },

      getTrackSettings: (trackId) => {
        return get().trackSettings.get(trackId) || {};
      },

      clearTrackSettings: (trackId) => {
        set((state) => {
          const newTrackSettings = new Map(state.trackSettings);
          newTrackSettings.delete(trackId);
          return { trackSettings: newTrackSettings };
        });
        get().markAsDirty();
      },

      setGroupSettings: (groupId, settings) => {
        set((state) => {
          const newGroupSettings = new Map(state.groupSettings);
          newGroupSettings.set(groupId, settings);
          return { groupSettings: newGroupSettings };
        });
        get().markAsDirty();
      },

      getGroupSettings: (groupId) => {
        return get().groupSettings.get(groupId) || {};
      },

      clearGroupSettings: (groupId) => {
        set((state) => {
          const newGroupSettings = new Map(state.groupSettings);
          newGroupSettings.delete(groupId);
          return { groupSettings: newGroupSettings };
        });
        get().markAsDirty();
      },

      startSession: () => {
        const state = get();
        if (state.sessionState.mode === 'session') return;

        set((state) => ({
          sessionState: {
            ...state.sessionState,
            mode: 'session' as ProjectSessionMode,
            sessionStartTime: Date.now(),
          },
        }));
        get().markAsDirty();
      },

      resetSession: () => {
        set({
          sessionState: { ...DEFAULT_SESSION_STATE },
        });
        get().markAsDirty();
      },

      markTrackAsPlayed: (trackId) => {
        set((state) => ({
          sessionState: {
            ...state.sessionState,
            playedTrackIds: [...state.sessionState.playedTrackIds, trackId],
          },
        }));
        get().markAsDirty();
      },

      setCurrentTrack: (trackId) => {
        set((state) => ({
          sessionState: {
            ...state.sessionState,
            currentTrackId: trackId,
          },
        }));
      },

      isTrackPlayed: (trackId) => {
        return get().sessionState.playedTrackIds.includes(trackId);
      },

      toggleTrackDisabled: (trackId) => {
        set((state) => {
          const disabledTrackIds = [...state.sessionState.disabledTrackIds];
          const index = disabledTrackIds.indexOf(trackId);
          if (index === -1) {
            disabledTrackIds.push(trackId);
          } else {
            disabledTrackIds.splice(index, 1);
          }
          return {
            sessionState: {
              ...state.sessionState,
              disabledTrackIds,
            },
          };
        });
        get().markAsDirty();
      },

      isTrackDisabled: (trackId) => {
        return get().sessionState.disabledTrackIds.includes(trackId);
      },

      toggleGroupDisabled: (groupId) => {
        const state = get();
        const group = findItemRecursive(state.items, groupId);

        if (!group || !isProjectGroup(group)) return;

        const allTracks = getAllTracksRecursive([group]);
        const disabledGroupIds = [...state.sessionState.disabledGroupIds];
        const disabledTrackIds = [...state.sessionState.disabledTrackIds];

        const groupIndex = disabledGroupIds.indexOf(groupId);
        if (groupIndex === -1) {
          disabledGroupIds.push(groupId);
          allTracks.forEach((track) => {
            if (!disabledTrackIds.includes(track.id)) {
              disabledTrackIds.push(track.id);
            }
          });
        } else {
          disabledGroupIds.splice(groupIndex, 1);
          allTracks.forEach((track) => {
            const trackIndex = disabledTrackIds.indexOf(track.id);
            if (trackIndex !== -1) {
              disabledTrackIds.splice(trackIndex, 1);
            }
          });
        }

        set({
          sessionState: {
            ...state.sessionState,
            disabledGroupIds,
            disabledTrackIds,
          },
        });
        get().markAsDirty();
      },

      isGroupDisabled: (groupId) => {
        return get().sessionState.disabledGroupIds.includes(groupId);
      },
    }),
    {
      name: 'cherryplaylist-project',
      version: 1,
      storage: electronStorage,
      partialize: (state) => ({
        name: state.name,
        items: state.items,
        settings: state.settings,
        trackSettings: Array.from(state.trackSettings.entries()),
        groupSettings: Array.from(state.groupSettings.entries()),
        sessionState: state.sessionState,
        meta: {
          filePath: state.meta.filePath,
          isDirty: state.meta.isDirty,
          lastSavedAt: state.meta.lastSavedAt,
        },
      }),
      merge: (
        persistedState: unknown,
        currentState: ProjectState,
      ) => {
        const state = persistedState as Partial<{
          name: string;
          items: ProjectItem[];
          settings: ProjectSettings;
          trackSettings: Array<[string, ProjectTrackSettings]>;
          groupSettings: Array<[string, ProjectGroupSettings]>;
          sessionState: ProjectSessionState;
          meta: ProjectMeta;
        }> | null | undefined;

        return {
          ...currentState,
          name: state?.name ?? currentState.name,
          items: state?.items ?? currentState.items,
          settings: state?.settings ?? currentState.settings,
          trackSettings: new Map(state?.trackSettings ?? []),
          groupSettings: new Map(state?.groupSettings ?? []),
          sessionState: state?.sessionState ?? currentState.sessionState,
          meta: state?.meta ?? currentState.meta,
          selectedItemIds: new Set<string>(),
        };
      },
    },
  ),
);

export function initializeProjectStoreHistory(): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registerProjectStore(PROJECT_WORKSPACE_ID, useProjectStore as any);

  registerExternalApplyHandler((workspaceId, command, mode) => {
    if (workspaceId === PROJECT_WORKSPACE_ID) {
      return useProjectStore.getState()._applyCommand(command, mode);
    }
    return false;
  });
}

export { PROJECT_WORKSPACE_ID };
