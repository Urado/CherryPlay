import { ProjectItem } from '@core/types/project';

import { cloneItems } from '../utils/historyCore';

import { CommandResult, HistoryCommand, ItemsState } from './index';

export class MoveItemCommand implements HistoryCommand {
  readonly type = 'moveItem';

  constructor(
    private readonly fromIndex: number,
    private readonly toIndex: number,
  ) {}

  execute(state: ItemsState): CommandResult {
    const newItems = [...state.items];
    if (this.fromIndex < 0 || this.fromIndex >= newItems.length) {
      return { success: false };
    }
    const [moved] = newItems.splice(this.fromIndex, 1);
    if (!moved) {
      return { success: false };
    }
    const targetIndex = Math.min(this.toIndex, newItems.length);
    newItems.splice(targetIndex, 0, moved);
    return { success: true, newState: { items: newItems } };
  }

  undo(state: ItemsState): CommandResult {
    const newItems = [...state.items];
    const effectiveToIndex = Math.min(this.toIndex, state.items.length - 1);
    if (effectiveToIndex < 0 || effectiveToIndex >= newItems.length) {
      return { success: false };
    }
    const [moved] = newItems.splice(effectiveToIndex, 1);
    if (!moved) {
      return { success: false };
    }
    newItems.splice(this.fromIndex, 0, moved);
    return { success: true, newState: { items: newItems } };
  }
}

export class MoveItemsCommand implements HistoryCommand {
  readonly type = 'moveItems';

  constructor(
    private readonly items: ProjectItem[],
    private readonly fromIndices: number[],
    private readonly toIndex: number,
  ) {}

  execute(state: ItemsState): CommandResult {
    const newItems = [...state.items];
    const sortedFromIndices = [...this.fromIndices].sort((a, b) => b - a);
    sortedFromIndices.forEach((index) => {
      newItems.splice(index, 1);
    });
    const insertIndex = Math.min(this.toIndex, newItems.length);
    newItems.splice(insertIndex, 0, ...cloneItems(this.items));
    return { success: true, newState: { items: newItems } };
  }

  undo(state: ItemsState): CommandResult {
    const newItems = [...state.items];
    const itemIds = new Set(this.items.map((i) => i.id));
    const filtered = newItems.filter((item) => !itemIds.has(item.id));
    const sortedFromIndices = [...this.fromIndices].sort((a, b) => a - b);
    let result = filtered;
    this.items.forEach((item, i) => {
      const insertAt = sortedFromIndices[i];
      result = [...result.slice(0, insertAt), item, ...result.slice(insertAt)];
    });
    return { success: true, newState: { items: result } };
  }
}
