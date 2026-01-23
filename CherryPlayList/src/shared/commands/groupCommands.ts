import { isProjectGroup, ProjectGroup, ProjectItem } from '@core/types/project';

import { updateGroupInItems } from '../stores/projectStoreCore';
import { cloneItems } from '../utils/historyCore';

import { CommandResult, HistoryCommand, ItemsState } from './index';

export class CreateGroupCommand implements HistoryCommand {
  readonly type = 'createGroup';

  constructor(
    private readonly groupId: string,
    private readonly groupName: string,
    _itemIds: string[],
    private readonly insertIndex: number,
    private readonly originalItems: ProjectItem[],
    private readonly originalIndices: number[],
  ) {}

  execute(state: ItemsState): CommandResult {
    const newItems = [...state.items];
    const sortedIndices = [...this.originalIndices].sort((a, b) => b - a);
    sortedIndices.forEach((index) => {
      if (index < newItems.length) {
        newItems.splice(index, 1);
      }
    });
    const group: ProjectGroup = {
      id: this.groupId,
      name: this.groupName,
      items: cloneItems(this.originalItems),
    };
    newItems.splice(this.insertIndex, 0, group);
    return { success: true, newState: { items: newItems } };
  }

  undo(state: ItemsState): CommandResult {
    const newItems = state.items.flatMap((item) => {
      if (isProjectGroup(item) && item.id === this.groupId) {
        return item.items;
      }
      return [item];
    });
    return { success: true, newState: { items: newItems } };
  }
}

export class UngroupCommand implements HistoryCommand {
  readonly type = 'ungroup';

  constructor(
    private readonly groupId: string,
    private readonly group: ProjectGroup,
    private readonly groupIndex: number,
  ) {}

  execute(state: ItemsState): CommandResult {
    const newItems = state.items.flatMap((item) => {
      if (isProjectGroup(item) && item.id === this.groupId) {
        return item.items;
      }
      return [item];
    });
    return { success: true, newState: { items: newItems } };
  }

  undo(state: ItemsState): CommandResult {
    const itemIds = new Set(this.group.items.map((i) => i.id));
    const filtered = state.items.filter((item) => !itemIds.has(item.id));
    const newItems = [
      ...filtered.slice(0, this.groupIndex),
      {
        id: this.group.id,
        name: this.group.name,
        items: cloneItems(this.group.items),
      },
      ...filtered.slice(this.groupIndex),
    ];
    return { success: true, newState: { items: newItems } };
  }
}

export class RenameGroupCommand implements HistoryCommand {
  readonly type = 'renameGroup';

  constructor(
    private readonly groupId: string,
    private readonly oldName: string,
    private readonly newName: string,
  ) {}

  execute(state: ItemsState): CommandResult {
    const newItems = updateGroupInItems(state.items, this.groupId, (grp) => ({
      ...grp,
      name: this.newName,
    }));
    return { success: true, newState: { items: newItems } };
  }

  undo(state: ItemsState): CommandResult {
    const newItems = updateGroupInItems(state.items, this.groupId, (grp) => ({
      ...grp,
      name: this.oldName,
    }));
    return { success: true, newState: { items: newItems } };
  }
}
