import { PARTY_WORKSPACE_ID, registerWorkspaceType } from '@core/constants/workspace';
import { IWorkspaceModule } from '@core/interfaces';
import { workspaceRegistry } from '@core/registry';

import { PartyView } from './PartyView';
import { PartyViewWrapper } from './PartyViewWrapper';

// Регистрируем тип workspace
registerWorkspaceType(PARTY_WORKSPACE_ID, 'party');

const PartyModule: IWorkspaceModule = {
  id: PARTY_WORKSPACE_ID,
  type: 'party',
  name: 'Party',
  component: PartyViewWrapper,
};

// Register the module
workspaceRegistry.register(PartyModule);

export { PartyView, PartyViewWrapper };
export default PartyModule;
