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
};

workspaceRegistry.register(AimpModule);

export { AimpView };
export default AimpModule;
