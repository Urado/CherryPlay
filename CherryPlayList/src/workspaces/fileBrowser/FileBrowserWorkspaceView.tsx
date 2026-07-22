import React from 'react';

import { SourcesPanel } from '@/components/SourcesPanel';
import { WorkspaceModuleProps } from '@core/interfaces';

export const FileBrowserWorkspaceView: React.FC<WorkspaceModuleProps> = ({ workspaceId }) => {
  return <SourcesPanel workspaceId={workspaceId} />;
};
