import { WorkspaceModuleProps } from '@core/interfaces';
import React from 'react';

import { SourcesPanel } from '@/components/SourcesPanel';

export const FileBrowserWorkspaceView: React.FC<WorkspaceModuleProps> = ({ workspaceId }) => {
  return <SourcesPanel workspaceId={workspaceId} />;
};
