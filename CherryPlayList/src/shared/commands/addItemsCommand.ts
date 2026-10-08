import {
  ProjectItem,
  type ProjectGroupSettings,
  type ProjectTrackSettings,
} from '@core/types/project';

import { insertItemAtPath } from '../stores/projectStoreCore';
import { cloneItem, cloneItems } from '../utils/historyCore';

import { CommandResult, HistoryCommand, ItemPosition, ItemsState } from '.';

export class AddItemsCommand implements HistoryCommand {
  readonly type = 'addItems';

  constructor(
    private readonly items: ProjectItem[],
    private readonly atIndex?: number,
  ) {}

  execute(state: ItemsState): CommandResult {
    const newItems = [...state.items];
    const insertIndex = this.atIndex ?? newItems.length;
    newItems.splice(insertIndex, 0, ...cloneItems(this.items));
    return { success: true, newState: { items: newItems } };
  }

  undo(state: ItemsState): CommandResult {
    const itemIds = new Set(this.items.map((i) => i.id));
    const newItems = state.items.filter((item) => !itemIds.has(item.id));
    return { success: true, newState: { items: newItems } };
  }
}

export type AddItemsAtPositionsSettings = {
  trackSettings?: Map<string, ProjectTrackSettings>;
  groupSettings?: Map<string, ProjectGroupSettings>;
};

export class AddItemsAtPositionsCommand implements HistoryCommand {
  readonly type = 'addItemsAtPositions';

  constructor(
    private readonly positions: ItemPosition[],
    private readonly addedSettings?: AddItemsAtPositionsSettings,
  ) {}

  execute(state: ItemsState): CommandResult {
    let newItems = [...state.items];
    const sortedPositions = [...this.positions].sort((a, b) => a.index - b.index);
    for (const pos of sortedPositions) {
      newItems = insertItemAtPath(newItems, cloneItem(pos.item), pos.parentPath, pos.index);
    }
    const newState: Partial<ItemsState> = { items: newItems };
    const trackEntries = this.addedSettings?.trackSettings;
    if (trackEntries && trackEntries.size > 0) {
      const nextTrackSettings = new Map(state.trackSettings ?? []);
      for (const [trackId, settings] of trackEntries) {
        nextTrackSettings.set(trackId, { ...settings });
      }
      newState.trackSettings = nextTrackSettings;
    }
    const groupEntries = this.addedSettings?.groupSettings;
    if (groupEntries && groupEntries.size > 0) {
      const nextGroupSettings = new Map(state.groupSettings ?? []);
      for (const [groupId, settings] of groupEntries) {
        nextGroupSettings.set(groupId, { ...settings });
      }
      newState.groupSettings = nextGroupSettings;
    }
    return { success: true, newState };
  }

  undo(state: ItemsState): CommandResult {
    const itemIds = new Set(this.positions.map((p) => p.item.id));
    const removeRecursive = (items: ProjectItem[]): ProjectItem[] => {
      return items
        .filter((item) => !itemIds.has(item.id))
        .map((item) => {
          if ('items' in item) {
            return { ...item, items: removeRecursive(item.items) };
          }
          return item;
        });
    };
    const newState: Partial<ItemsState> = { items: removeRecursive(state.items) };
    const trackEntries = this.addedSettings?.trackSettings;
    if (trackEntries && trackEntries.size > 0) {
      const nextTrackSettings = new Map(state.trackSettings ?? []);
      for (const trackId of trackEntries.keys()) {
        nextTrackSettings.delete(trackId);
      }
      newState.trackSettings = nextTrackSettings;
    }
    const groupEntries = this.addedSettings?.groupSettings;
    if (groupEntries && groupEntries.size > 0) {
      const nextGroupSettings = new Map(state.groupSettings ?? []);
      for (const groupId of groupEntries.keys()) {
        nextGroupSettings.delete(groupId);
      }
      newState.groupSettings = nextGroupSettings;
    }
    return { success: true, newState };
  }
}
