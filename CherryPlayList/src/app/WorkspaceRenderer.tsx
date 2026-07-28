import React, { memo } from 'react';

import { workspaceRegistry } from '@core/registry';
import { WorkspaceZone } from '@core/types/layout';
import { DEMO_UNAVAILABLE_MESSAGE, getPlatformCapabilities } from '@shared/platform';
import { LegacyAimpWorkspaceAdapter } from '@workspaces/player/components/LegacyAimpWorkspaceAdapter';

interface WorkspaceRendererProps {
  zone: WorkspaceZone;
}

/**
 * Компонент для рендеринга workspace зон на основе типа
 * Использует реестр модулей для динамического рендеринга
 */
const WorkspaceRendererComponent: React.FC<WorkspaceRendererProps> = ({ zone }) => {
  const { supportsAimpWorkspace, mode } = getPlatformCapabilities();

  if (zone.workspaceType === 'aimp') {
    if (!supportsAimpWorkspace) {
      const message =
        mode === 'demo'
          ? DEMO_UNAVAILABLE_MESSAGE
          : 'AIMP workspace is not available on this platform.';
      return (
        <div className="empty-state">
          <p>{message}</p>
        </div>
      );
    }

    return <LegacyAimpWorkspaceAdapter zoneId={zone.id} />;
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
