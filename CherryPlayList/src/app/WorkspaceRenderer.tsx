import React, { memo } from 'react';

import { workspaceRegistry } from '@core/registry';
import { WorkspaceZone } from '@core/types/layout';
import { DEMO_UNAVAILABLE_MESSAGE, getAppMode } from '@shared/platform';

import { SourcesPanel } from '../components/SourcesPanel';

interface WorkspaceRendererProps {
  zone: WorkspaceZone;
}

/**
 * Компонент для рендеринга workspace зон на основе типа
 * Использует реестр модулей для динамического рендеринга
 */
const WorkspaceRendererComponent: React.FC<WorkspaceRendererProps> = ({ zone }) => {
  if (zone.workspaceType === 'aimp' && getAppMode() === 'demo') {
    return (
      <div className="empty-state">
        <p>{DEMO_UNAVAILABLE_MESSAGE}</p>
      </div>
    );
  }

  // Special case for fileBrowser - it uses SourcesPanel
  if (zone.workspaceType === 'fileBrowser') {
    return (
      <>
        <h2 className="panel-title">Источники</h2>
        <SourcesPanel />
      </>
    );
  }

  // Try to get module by ID first (for specific workspaces like playlist)
  let module = workspaceRegistry.getModule(zone.workspaceId);

  // If not found by ID, try to get by type (for dynamic workspaces like collection)
  if (!module) {
    module = workspaceRegistry.getModuleByType(zone.workspaceType);
  }

  if (!module) {
    return (
      <div className="empty-state">
        <p>Unknown workspace type: {zone.workspaceType}</p>
      </div>
    );
  }

  // Render the workspace component
  return React.createElement(module.component, { workspaceId: zone.workspaceId, zoneId: zone.id });
};

export const WorkspaceRenderer = memo(WorkspaceRendererComponent);

WorkspaceRenderer.displayName = 'WorkspaceRenderer';
