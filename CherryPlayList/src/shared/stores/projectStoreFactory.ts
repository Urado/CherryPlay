import { v4 as uuidv4 } from 'uuid';
import { StoreApi, UseBoundStore } from 'zustand';
import { persist } from 'zustand/middleware';
import { createWithEqualityFn, useStoreWithEqualityFn } from 'zustand/traditional';

import {
  DEFAULT_PROJECT_META,
  DEFAULT_PROJECT_SETTINGS,
  DEFAULT_SESSION_STATE,
  isProjectGroup,
  isProjectTrack,
  ProjectGroup,
  ProjectGroupSettings,
  ProjectItem,
  ProjectMeta,
  ProjectSessionState,
  ProjectSettings,
  ProjectTrackSettings,
} from '@core/types/project';
import { Track } from '@core/types/track';
import { WorkspaceId } from '@core/types/workspace';

import {
  HistoryCommand,
  ItemsState,
  AddItemsCommand,
  RemoveItemsCommand,
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
import {
  findItemRecursive,
  getAllTracksRecursive,
  getItemPathRecursive,
  getFlatItemList,
  removeItemFromItems,
  updateTrackInItems,
  removeItemsById,
  collectItemsById,
  insertIntoGroup,
} from './projectStoreCore';

export interface ProjectStoreOptions {
  workspaceId: WorkspaceId;
  initialName?: string;
  persist?: boolean;
  supportsGroups?: boolean;
  maxItems?: number | null;
  historyDepth?: number;
}

export interface ProjectStoreState {
  workspaceId: WorkspaceId;
  name: string;
  items: ProjectItem[];
  settings: ProjectSettings;
  trackSettings: Map<string, ProjectTrackSettings>;
  groupSettings: Map<string, ProjectGroupSettings>;
  sessionState: ProjectSessionState;
  meta: ProjectMeta;
  supportsGroups: boolean;
  maxItems: number | null;
  selectedItemIds: Set<string>;
  _skipHistory: boolean;

  setName: (name: string) => void;
  clear: () => void;
  loadData: (data: {
    name: string;
    items: ProjectItem[];
    settings?: ProjectSettings;
    trackSettings?: Map<string, ProjectTrackSettings>;
    groupSettings?: Map<string, ProjectGroupSettings>;
    sessionState?: ProjectSessionState;
    filePath?: string;
  }) => void;
  setFilePath: (path: string | null) => void;
  markAsDirty: () => void;
  resetDirty: () => void;

  addItem: (item: Omit<Track, 'id'>, index?: number) => void;
  addItems: (items: Omit<Track, 'id'>[], index?: number) => void;
  addItemsWithHistory: (items: ProjectItem[], index?: number) => void;
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

  selectItem: (id: string) => void;
  deselectItem: (id: string) => void;
  toggleItemSelection: (id: string) => void;
  selectAll: () => void;
  deselectAll: () => void;
  removeSelectedItems: () => void;
  moveSelectedItems: (toIndex: number) => void;
  selectRange: (fromId: string, toId: string) => void;
  /** Move items to a specific context (root or inside a group) */
  moveItemsToContext: (
    itemIds: string[],
    targetParentId: string | null,
    targetIndex: number,
  ) => void;

  setTrackSettings: (trackId: string, settings: ProjectTrackSettings) => void;
  getTrackSettings: (trackId: string) => ProjectTrackSettings;
  clearTrackSettings: (trackId: string) => void;

  startSession: () => void;
  resetSession: () => void;
  markTrackAsPlayed: (trackId: string) => void;
  setCurrentTrack: (trackId: string | null) => void;
  isTrackPlayed: (trackId: string) => boolean;
  toggleTrackDisabled: (trackId: string) => void;
  isTrackDisabled: (trackId: string) => boolean;

  _applyCommand: (command: HistoryCommand, mode: 'execute' | 'undo') => boolean;
  _setItems: (items: ProjectItem[]) => void;
}

export type ProjectStore = UseBoundStore<StoreApi<ProjectStoreState>>;

const projectStores = new Map<WorkspaceId, ProjectStore>();

function createStoreImpl(options: ProjectStoreOptions): ProjectStore {
  const {
    workspaceId,
    initialName = 'New Project',
    persist: shouldPersist = false,
    supportsGroups = true,
    maxItems = null,
  } = options;

  const storeCreator = (
    set: (
      partial:
        | Partial<ProjectStoreState>
        | ((state: ProjectStoreState) => Partial<ProjectStoreState>),
    ) => void,
    get: () => ProjectStoreState,
  ): ProjectStoreState => ({
    workspaceId,
    name: initialName,
    items: [],
    settings: { ...DEFAULT_PROJECT_SETTINGS },
    trackSettings: new Map(),
    groupSettings: new Map(),
    sessionState: { ...DEFAULT_SESSION_STATE },
    meta: { ...DEFAULT_PROJECT_META },
    supportsGroups,
    maxItems,
    selectedItemIds: new Set<string>(),
    _skipHistory: false,

    setName: (name) => {
      const state = get();
      const oldName = state.name;
      if (oldName === name) return;

      set({ name });

      if (!state._skipHistory) {
        useGlobalHistoryStore.getState().pushCommand(
          workspaceId,
          new SetNameCommand(oldName, name),
          `Rename to "${name}"`,
        );
      }

      get().markAsDirty();
    },

    clear: () => {
      set({
        name: initialName,
        items: [],
        settings: { ...DEFAULT_PROJECT_SETTINGS },
        trackSettings: new Map(),
        groupSettings: new Map(),
        sessionState: { ...DEFAULT_SESSION_STATE },
        meta: { ...DEFAULT_PROJECT_META },
        selectedItemIds: new Set(),
      });
    },

    loadData: (data) => {
      set({
        name: data.name,
        items: data.items,
        settings: data.settings || { ...DEFAULT_PROJECT_SETTINGS },
        trackSettings: data.trackSettings || new Map(),
        groupSettings: data.groupSettings || new Map(),
        sessionState: data.sessionState || { ...DEFAULT_SESSION_STATE },
        meta: {
          filePath: data.filePath || null,
          isDirty: false,
          lastSavedAt: Date.now(),
        },
        selectedItemIds: new Set(),
      });
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
      if (state.maxItems !== null && state.items.length >= state.maxItems) {
        return;
      }

      const newItem: Track = { ...item, id: uuidv4() };
      const insertIndex = index ?? state.items.length;

      set((s) => {
        const newItems = [...s.items];
        newItems.splice(insertIndex, 0, newItem);
        return { items: newItems };
      });

      if (!state._skipHistory) {
        useGlobalHistoryStore.getState().pushCommand(
          workspaceId,
          new AddItemsCommand([cloneItem(newItem)], insertIndex),
          `Add "${newItem.name}"`,
        );
      }

      get().markAsDirty();
    },

    addItems: (items, index) => {
      const state = get();
      const availableSlots =
        state.maxItems === null ? items.length : state.maxItems - state.items.length;
      if (availableSlots <= 0) return;

      const itemsToAdd = items.slice(0, availableSlots);
      const itemsWithIds: Track[] = itemsToAdd.map((item) => ({ ...item, id: uuidv4() }));
      const insertIndex = index ?? state.items.length;

      set((s) => {
        const newItems = [...s.items];
        newItems.splice(insertIndex, 0, ...itemsWithIds);
        return { items: newItems };
      });

      if (!state._skipHistory) {
        useGlobalHistoryStore.getState().pushCommand(
          workspaceId,
          new AddItemsCommand(cloneItems(itemsWithIds), insertIndex),
          `Add ${itemsWithIds.length} items`,
        );
      }

      get().markAsDirty();
    },

    addItemsWithHistory: (items, index) => {
      const state = get();
      const availableSlots =
        state.maxItems === null ? items.length : state.maxItems - state.items.length;
      if (availableSlots <= 0) return;

      const itemsToAdd = items.slice(0, availableSlots);
      const insertIndex = index ?? state.items.length;

      set((s) => {
        const newItems = [...s.items];
        newItems.splice(insertIndex, 0, ...itemsToAdd);
        return { items: newItems };
      });

      if (!state._skipHistory) {
        useGlobalHistoryStore.getState().pushCommand(
          workspaceId,
          new AddItemsCommand(cloneItems(itemsToAdd), insertIndex),
          `Add ${itemsToAdd.length} items`,
        );
      }

      get().markAsDirty();
    },

    removeItem: (id) => {
      const state = get();
      const itemIndex = state.items.findIndex((item) => item.id === id);
      const itemToRemove = itemIndex !== -1 ? state.items[itemIndex] : null;

      if (!itemToRemove) {
        const foundItem = findItemRecursive(state.items, id);
        if (!foundItem) return;

        set((s) => ({
          items: removeItemFromItems(s.items, id),
          selectedItemIds: new Set([...s.selectedItemIds].filter((sid) => sid !== id)),
        }));

        get().markAsDirty();
        return;
      }

      set((s) => ({
        items: s.items.filter((item) => item.id !== id),
        selectedItemIds: new Set([...s.selectedItemIds].filter((sid) => sid !== id)),
      }));

      if (!state._skipHistory) {
        useGlobalHistoryStore.getState().pushCommand(
          workspaceId,
          new RemoveItemsCommand([cloneItem(itemToRemove)], [itemIndex]),
          `Remove "${isProjectTrack(itemToRemove) ? itemToRemove.name : itemToRemove.name}"`,
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
          workspaceId,
          new MoveItemCommand(fromIndex, toIndex),
          `Move item from ${fromIndex} to ${toIndex}`,
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
      if (!state.supportsGroups || itemIds.length < 2) {
        return '';
      }

      const itemIndices: number[] = [];
      const itemsToGroup: ProjectItem[] = [];

      itemIds.forEach((id) => {
        const index = state.items.findIndex((item) => item.id === id);
        if (index !== -1) {
          itemIndices.push(index);
          itemsToGroup.push(state.items[index]);
        }
      });

      if (itemsToGroup.length < 2) return '';

      const sortedIndices = [...itemIndices].sort((a, b) => a - b);
      for (let i = 1; i < sortedIndices.length; i++) {
        if (sortedIndices[i] !== sortedIndices[i - 1] + 1) {
          return '';
        }
      }

      const groupId = uuidv4();
      const groupName = name || `Group ${itemsToGroup.length}`;
      const insertIndex = sortedIndices[0];

      const group: ProjectGroup = {
        id: groupId,
        name: groupName,
        items: itemsToGroup.map((item) => cloneItem(item)),
      };

      set((s) => {
        const newItems = [...s.items];
        const sortedIndicesDesc = [...sortedIndices].sort((a, b) => b - a);
        sortedIndicesDesc.forEach((index) => {
          newItems.splice(index, 1);
        });
        newItems.splice(insertIndex, 0, group);
        return { items: newItems };
      });

      if (!state._skipHistory) {
        useGlobalHistoryStore.getState().pushCommand(
          workspaceId,
          new CreateGroupCommand(
            groupId,
            groupName,
            itemIds,
            insertIndex,
            cloneItems(itemsToGroup),
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

      if (!groupToUngroup || !isProjectGroup(groupToUngroup)) return;

      set((s) => {
        const newItems = [...s.items];
        newItems.splice(groupIndex, 1, ...groupToUngroup.items);
        return { items: newItems };
      });

      if (!state._skipHistory) {
        useGlobalHistoryStore.getState().pushCommand(
          workspaceId,
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
      if (!group || !isProjectGroup(group)) return;

      const oldName = group.name;
      if (oldName === name) return;

      set((s) => ({
        items: s.items.map((item) => {
          if (item.id === groupId && isProjectGroup(item)) {
            return { ...item, name };
          }
          return item;
        }),
      }));

      if (!state._skipHistory) {
        useGlobalHistoryStore.getState().pushCommand(
          workspaceId,
          new RenameGroupCommand(groupId, oldName, name),
          `Rename group to "${name}"`,
        );
      }

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
      if (selectedIds.length === 0) return;

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
          workspaceId,
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
      if (selectedIds.length === 0) return;

      const flatList = getFlatItemList(state.items);
      const itemsWithInfo: Array<{
        item: ProjectItem;
        flatIndex: number;
        indexInParent: number;
      }> = [];

      selectedIds.forEach((id) => {
        const flatIndex = flatList.findIndex((x) => x.item.id === id);
        if (flatIndex !== -1) {
          const rootIndex = state.items.findIndex((item) => item.id === id);
          if (rootIndex !== -1) {
            itemsWithInfo.push({
              item: state.items[rootIndex],
              flatIndex,
              indexInParent: rootIndex,
            });
          }
        }
      });

      if (itemsWithInfo.length === 0) return;

      itemsWithInfo.sort((a, b) => a.flatIndex - b.flatIndex);
      const itemsToMove = itemsWithInfo.map((x) => cloneItem(x.item));

      let newItems = [...state.items];
      const sortedByIndexDesc = [...itemsWithInfo].sort((a, b) => b.indexInParent - a.indexInParent);
      sortedByIndexDesc.forEach((info) => {
        newItems.splice(info.indexInParent, 1);
      });

      const insertIndex = Math.min(toIndex, newItems.length);
      newItems.splice(insertIndex, 0, ...itemsToMove);

      set({ items: newItems });

      if (!state._skipHistory) {
        useGlobalHistoryStore.getState().pushCommand(
          workspaceId,
          new MoveItemsCommand(
            cloneItems(itemsToMove),
            itemsWithInfo.map((x) => x.indexInParent),
            insertIndex,
          ),
          `Move ${itemsToMove.length} items`,
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
        // Для истории используем MoveItemsCommand с информацией о контексте
        // TODO: создать специализированную команду для moveItemsToContext
        // Пока используем простое описание
        useGlobalHistoryStore.getState().pushCommand(
          workspaceId,
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

    startSession: () => {
      set((state) => ({
        sessionState: {
          ...state.sessionState,
          mode: 'session',
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

    _setItems: (items) => {
      set({ items });
    },
  });

  if (shouldPersist) {
    return createWithEqualityFn<ProjectStoreState>()(
      persist(storeCreator, {
        name: `cherryplaylist-${workspaceId}`,
        version: 1,
        storage: electronStorage,
        partialize: (state) => ({
          workspaceId: state.workspaceId,
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
        merge: (persistedState: unknown, currentState: ProjectStoreState) => {
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
      }),
    );
  }

  return createWithEqualityFn<ProjectStoreState>(storeCreator);
}

export function ensureProjectStore(options: ProjectStoreOptions): ProjectStore {
  const existing = projectStores.get(options.workspaceId);
  if (existing) {
    return existing;
  }

  const store = createStoreImpl(options);
  projectStores.set(options.workspaceId, store);

  return store;
}

export function getProjectStore(workspaceId: WorkspaceId): ProjectStore | undefined {
  return projectStores.get(workspaceId);
}

export function removeProjectStore(workspaceId: WorkspaceId): void {
  const store = projectStores.get(workspaceId);
  if (!store) return;

  projectStores.delete(workspaceId);
  store.destroy();
}

export function getAllProjectStoreIds(): WorkspaceId[] {
  return Array.from(projectStores.keys());
}

export function registerProjectStore(workspaceId: WorkspaceId, store: ProjectStore): void {
  projectStores.set(workspaceId, store);
}

export function useProjectStoreSelector<T>(
  workspaceId: WorkspaceId,
  selector: (state: ProjectStoreState) => T,
  equalityFn?: (a: T, b: T) => boolean,
): T {
  const store = projectStores.get(workspaceId);
  if (!store) {
    throw new Error(`Project store ${workspaceId} is not registered`);
  }
  return useStoreWithEqualityFn(store, selector, equalityFn);
}

let externalApplyHandler: ((workspaceId: WorkspaceId, command: HistoryCommand, mode: 'execute' | 'undo') => boolean) | null = null;

export function registerExternalApplyHandler(
  handler: (workspaceId: WorkspaceId, command: HistoryCommand, mode: 'execute' | 'undo') => boolean,
): void {
  externalApplyHandler = handler;
}

export function initializeGlobalHistory(): void {
  useGlobalHistoryStore.getState().registerApplyCommand((workspaceId, command, mode) => {
    const store = projectStores.get(workspaceId);
    if (store) {
      return store.getState()._applyCommand(command, mode);
    }

    if (externalApplyHandler) {
      return externalApplyHandler(workspaceId, command, mode);
    }

    console.error(`Store not found for workspace: ${workspaceId}`);
    return false;
  });
}
