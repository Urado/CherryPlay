import { DEFAULT_PLAYER_WORKSPACE_ID, registerWorkspaceType } from '@core/constants/workspace';
import { IWorkspaceModule } from '@core/interfaces';
import { workspaceRegistry } from '@core/registry';

import { PlayerViewContainer } from './components/PlayerViewContainer';

// Регистрируем тип workspace
registerWorkspaceType(DEFAULT_PLAYER_WORKSPACE_ID, 'player');

const PlayerModule: IWorkspaceModule = {
  id: DEFAULT_PLAYER_WORKSPACE_ID,
  type: 'player',
  name: 'Player',
  component: PlayerViewContainer,
  minWidth: 320,
  minHeight: 120,
};

// Register the module
workspaceRegistry.register(PlayerModule);

export { PlayerViewContainer } from './components/PlayerViewContainer';
export { PlayerView } from './PlayerView';
export default PlayerModule;
