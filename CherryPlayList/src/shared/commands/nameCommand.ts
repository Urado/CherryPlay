import { CommandResult, HistoryCommand, ItemsState } from './index';

export class SetNameCommand implements HistoryCommand {
  readonly type = 'setName';

  constructor(
    private readonly oldName: string,
    private readonly newName: string,
  ) {}

  execute(_state: ItemsState): CommandResult {
    return { success: true, newState: { name: this.newName } };
  }

  undo(_state: ItemsState): CommandResult {
    return { success: true, newState: { name: this.oldName } };
  }
}
