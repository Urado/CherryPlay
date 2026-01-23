import { ProjectItem } from '@core/types/project';

import { insertItemAtPath, removeItemFromItems } from '../stores/projectStoreCore';
import { cloneItem } from '../utils/historyCore';

import { CommandResult, HistoryCommand, ItemPosition, ItemsState } from './index';

export class RemoveItemsCommand implements HistoryCommand {
  readonly type = 'removeItems';

  constructor(
    private readonly items: ProjectItem[],
    private readonly indices: number[],
  ) {}

  execute(state: ItemsState): CommandResult {
    let newItems = [...state.items];
    for (const item of this.items) {
      newItems = removeItemFromItems(newItems, item.id);
    }
    return { success: true, newState: { items: newItems } };
  }

  undo(state: ItemsState): CommandResult {
    let newItems = [...state.items];
    const sortedEntries = this.items
      .map((item, i) => ({ item, index: this.indices[i] }))
      .sort((a, b) => a.index - b.index);

    for (const entry of sortedEntries) {
      newItems = insertItemAtPath(newItems, cloneItem(entry.item), [], entry.index);
    }
    return { success: true, newState: { items: newItems } };
  }
}

export class RemoveNestedItemCommand implements HistoryCommand {
  readonly type = 'removeNestedItem';

  constructor(
    private readonly item: ProjectItem,
    private readonly parentPath: string[],
    private readonly indexInParent: number,
  ) {}

  execute(state: ItemsState): CommandResult {
    const newItems = removeItemFromItems(state.items, this.item.id);
    return { success: true, newState: { items: newItems } };
  }

  undo(state: ItemsState): CommandResult {
    const newItems = insertItemAtPath(
      state.items,
      cloneItem(this.item),
      this.parentPath,
      this.indexInParent,
    );
    return { success: true, newState: { items: newItems } };
  }
}

export class RemoveItemsAtPositionsCommand implements HistoryCommand {
  readonly type = 'removeItemsAtPositions';

  constructor(private readonly positions: ItemPosition[]) {}

  execute(state: ItemsState): CommandResult {
    let newItems = [...state.items];
    for (const pos of this.positions) {
      newItems = removeItemFromItems(newItems, pos.item.id);
    }
    return { success: true, newState: { items: newItems } };
  }

  undo(state: ItemsState): CommandResult {
    let newItems = [...state.items];
    const sortedPositions = [...this.positions].sort((a, b) => a.index - b.index);
    for (const pos of sortedPositions) {
      newItems = insertItemAtPath(newItems, cloneItem(pos.item), pos.parentPath, pos.index);
    }
    return { success: true, newState: { items: newItems } };
  }
}
