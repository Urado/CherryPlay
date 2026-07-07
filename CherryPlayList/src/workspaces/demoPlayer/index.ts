import { DEFAULT_DEMO_PLAYER_WORKSPACE_ID, registerWorkspaceType } from '@core/constants/workspace';
import { IWorkspaceModule } from '@core/interfaces';
import { workspaceRegistry } from '@core/registry';

import DemoPlayerWorkspaceView from './DemoPlayerWorkspaceView';

registerWorkspaceType(DEFAULT_DEMO_PLAYER_WORKSPACE_ID, 'demo-player');

const DemoPlayerModule: IWorkspaceModule = {
  id: DEFAULT_DEMO_PLAYER_WORKSPACE_ID,
  type: 'demo-player',
  name: 'Demo Player',
  component: DemoPlayerWorkspaceView,
};

workspaceRegistry.register(DemoPlayerModule);

export default DemoPlayerModule;
