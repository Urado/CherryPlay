import { WorkspaceId } from '@core/types/workspace';
import React from 'react';


import { PartyWorkspaceViewWrapper } from './PartyWorkspaceViewWrapper';

interface PartyPreviewViewWrapperProps {
  workspaceId: WorkspaceId;
  zoneId: string;
}

export const PartyPreviewViewWrapper: React.FC<PartyPreviewViewWrapperProps> = (props) => (
  <PartyWorkspaceViewWrapper {...props} view="preview" />
);
