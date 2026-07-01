import {
  PARTY_EDITOR_WORKSPACE_ID,
  PARTY_PREVIEW_WORKSPACE_ID,
  registerWorkspaceType,
} from '@core/constants/workspace';
import { IWorkspaceModule } from '@core/interfaces';
import { workspaceRegistry } from '@core/registry';

import { PartyEditorViewWrapper } from './PartyEditorViewWrapper';
import { PartyPreviewViewWrapper } from './PartyPreviewViewWrapper';
import { usePartyWorkspaceRuntime } from './usePartyWorkspace';

registerWorkspaceType(PARTY_EDITOR_WORKSPACE_ID, 'party-editor');
registerWorkspaceType(PARTY_PREVIEW_WORKSPACE_ID, 'party-preview');

const PartyEditorModule: IWorkspaceModule = {
  id: PARTY_EDITOR_WORKSPACE_ID,
  type: 'party-editor',
  name: 'Party Editor',
  component: PartyEditorViewWrapper,
};

const PartyPreviewModule: IWorkspaceModule = {
  id: PARTY_PREVIEW_WORKSPACE_ID,
  type: 'party-preview',
  name: 'Party Preview',
  component: PartyPreviewViewWrapper,
};

workspaceRegistry.register(PartyEditorModule);
workspaceRegistry.register(PartyPreviewModule);

export {
  PARTY_EDITOR_WORKSPACE_ID,
  PARTY_PREVIEW_WORKSPACE_ID,
  PartyEditorViewWrapper,
  PartyPreviewViewWrapper,
  usePartyWorkspaceRuntime,
};

export default PartyEditorModule;
