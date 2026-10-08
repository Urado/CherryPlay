import type { WorkspaceId } from '@core/types/workspace';
import React from 'react';


import { FileBrowser } from './FileBrowser';

interface SourcesPanelProps {
  workspaceId: WorkspaceId;
}

export const SourcesPanel: React.FC<SourcesPanelProps> = ({ workspaceId }) => {
  return (
    <div className="sources-panel">
      <FileBrowser workspaceId={workspaceId} />
    </div>
  );
};
