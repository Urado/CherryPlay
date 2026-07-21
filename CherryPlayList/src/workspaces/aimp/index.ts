import { AIMP_WORKSPACE_ID, registerWorkspaceType } from '@core/constants/workspace';
import { IWorkspaceModule } from '@core/interfaces';
import { workspaceRegistry } from '@core/registry';

import { AimpView } from './AimpView';

registerWorkspaceType(AIMP_WORKSPACE_ID, 'aimp');

const AimpModule: IWorkspaceModule = {
  id: AIMP_WORKSPACE_ID,
  type: 'aimp',
  name: 'AIMP',
  component: AimpView,
  // Same as `player`; also normalized to `player` at lookup time.
  minWidth: 320,
  minHeight: 120,
};

workspaceRegistry.register(AimpModule);

export { AimpView };
export default AimpModule;
