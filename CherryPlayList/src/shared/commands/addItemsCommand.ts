import { ProjectItem } from '@core/types/project';

import { insertItemAtPath } from '../stores/projectStoreCore';
import { cloneItem, cloneItems } from '../utils/historyCore';

import { CommandResult, HistoryCommand, ItemPosition, ItemsState } from './index';

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

export class AddItemsAtPositionsCommand implements HistoryCommand {
  readonly type = 'addItemsAtPositions';

  constructor(private readonly positions: ItemPosition[]) {}

  execute(state: ItemsState): CommandResult {
    let newItems = [...state.items];
    const sortedPositions = [...this.positions].sort((a, b) => a.index - b.index);
    for (const pos of sortedPositions) {
      newItems = insertItemAtPath(newItems, cloneItem(pos.item), pos.parentPath, pos.index);
    }
    return { success: true, newState: { items: newItems } };
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
    return { success: true, newState: { items: removeRecursive(state.items) } };
  }
}
