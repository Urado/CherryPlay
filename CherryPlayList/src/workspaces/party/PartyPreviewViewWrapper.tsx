import React from 'react';

import { WorkspaceId } from '@core/types/workspace';

import { PartyWorkspaceViewWrapper } from './PartyWorkspaceViewWrapper';

interface PartyPreviewViewWrapperProps {
  workspaceId: WorkspaceId;
  zoneId: string;
}

export const PartyPreviewViewWrapper: React.FC<PartyPreviewViewWrapperProps> = (props) => (
  <PartyWorkspaceViewWrapper {...props} view="preview" />
);
