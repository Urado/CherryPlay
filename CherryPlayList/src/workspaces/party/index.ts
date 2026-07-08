import {
  PARTY_EDITOR_WORKSPACE_ID,
  PARTY_PREVIEW_WORKSPACE_ID,
  registerWorkspaceType,
} from '@core/constants/workspace';
import { IWorkspaceModule } from '@core/interfaces';
import { workspaceRegistry } from '@core/registry';

import { PartyEditorViewWrapper } from './PartyEditorViewWrapper';
import { PartyPreviewViewWrapper } from './PartyPreviewViewWrapper';
import {
  PartyWorkspaceRuntimeProvider,
  usePartyWorkspaceRuntimeContext,
} from './partyWorkspaceRuntimeContext';
import { usePartyWorkspaceRuntime } from './usePartyWorkspace';

registerWorkspaceType(PARTY_EDITOR_WORKSPACE_ID, 'party-editor');
registerWorkspaceType(PARTY_PREVIEW_WORKSPACE_ID, 'party-preview');

const PartyEditorModule: IWorkspaceModule = {
  id: PARTY_EDITOR_WORKSPACE_ID,
  type: 'party-editor',
  name: 'Party Editor',
  component: PartyEditorViewWrapper,
  minWidth: 400,
  minHeight: 300,
};

const PartyPreviewModule: IWorkspaceModule = {
  id: PARTY_PREVIEW_WORKSPACE_ID,
  type: 'party-preview',
  name: 'Party Preview',
  component: PartyPreviewViewWrapper,
  minWidth: 320,
  minHeight: 240,
};

workspaceRegistry.register(PartyEditorModule);
workspaceRegistry.register(PartyPreviewModule);

export {
  PARTY_EDITOR_WORKSPACE_ID,
  PARTY_PREVIEW_WORKSPACE_ID,
  PartyEditorViewWrapper,
  PartyPreviewViewWrapper,
  PartyWorkspaceRuntimeProvider,
  usePartyWorkspaceRuntime,
  usePartyWorkspaceRuntimeContext,
};

export default PartyEditorModule;
