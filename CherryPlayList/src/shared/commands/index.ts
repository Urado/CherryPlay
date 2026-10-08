import {
  ProjectItem,
  type ProjectGroupSettings,
  type ProjectTrackSettings,
} from '@core/types/project';

export interface ItemsState {
  items: ProjectItem[];
  name: string;
  trackSettings?: Map<string, ProjectTrackSettings>;
  groupSettings?: Map<string, ProjectGroupSettings>;
}

export interface CommandResult {
  success: boolean;
  newState?: Partial<ItemsState>;
}

export interface HistoryCommand {
  readonly type: string;
  execute(state: ItemsState): CommandResult;
  undo(state: ItemsState): CommandResult;
}

export interface ItemPosition {
  item: ProjectItem;
  parentPath: string[];
  index: number;
}

export { AddItemsCommand, AddItemsAtPositionsCommand } from './addItemsCommand';
export {
  RemoveItemsCommand,
  RemoveNestedItemCommand,
  RemoveItemsAtPositionsCommand,
} from './removeItemsCommand';
export { MoveItemCommand, MoveItemsCommand } from './moveItemsCommand';
export { CreateGroupCommand, UngroupCommand, RenameGroupCommand } from './groupCommands';
export { SetNameCommand } from './nameCommand';
