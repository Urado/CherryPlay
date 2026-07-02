import React from 'react';

import { WorkspaceId } from '@core/types/workspace';

import { PartyWorkspaceViewWrapper } from './PartyWorkspaceViewWrapper';

interface PartyEditorViewWrapperProps {
  workspaceId: WorkspaceId;
  zoneId: string;
}

export const PartyEditorViewWrapper: React.FC<PartyEditorViewWrapperProps> = (props) => (
  <PartyWorkspaceViewWrapper {...props} view="editor" />
);
