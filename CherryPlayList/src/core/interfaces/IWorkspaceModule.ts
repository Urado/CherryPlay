import React from 'react';

import { WorkspaceId } from '../types/workspace';

export interface WorkspaceModuleProps {
  workspaceId: WorkspaceId;
  zoneId: string;
}

export interface IWorkspaceModule {
  id: WorkspaceId;
  type: string; // e.g., 'playlist', 'collection', 'fileBrowser'
  name: string;
  component: React.FC<WorkspaceModuleProps>;
  // Optional: icon, default settings, etc.
}
