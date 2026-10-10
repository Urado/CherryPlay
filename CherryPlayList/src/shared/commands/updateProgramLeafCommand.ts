import type { ProgramTrack } from '@core/types/project';

import { updateProgramLeafInItems } from '../stores/projectStoreCore';
import { cloneItem } from '../utils/historyCore';

import { CommandResult, HistoryCommand, ItemsState } from '.';

export class UpdateProgramLeafCommand implements HistoryCommand {
  readonly type = 'updateProgramLeaf';

  constructor(
    private readonly itemId: string,
    private readonly before: ProgramTrack,
    private readonly after: ProgramTrack,
  ) {}

  execute(state: ItemsState): CommandResult {
    return {
      success: true,
      newState: {
        items: updateProgramLeafInItems(state.items, this.itemId, () => cloneItem(this.after)),
      },
    };
  }

  undo(state: ItemsState): CommandResult {
    return {
      success: true,
      newState: {
        items: updateProgramLeafInItems(state.items, this.itemId, () => cloneItem(this.before)),
      },
    };
  }
}
