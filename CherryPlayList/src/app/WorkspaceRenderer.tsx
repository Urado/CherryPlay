import { getWorkspaceDisplayNameRu } from '@core/constants/workspaceDisplayNames';
import { workspaceRegistry } from '@core/registry';
import { WorkspaceZone } from '@core/types/layout';
import { DEMO_UNAVAILABLE_MESSAGE, getPlatformCapabilities } from '@shared/platform';
import { useProjectStore } from '@shared/stores';
import { prepareWorkspaceInstance } from '@shared/utils/workspaceLifecycle';
import { LegacyAimpWorkspaceAdapter } from '@workspaces/player/components/LegacyAimpWorkspaceAdapter';
import React, { memo, useEffect } from 'react';

interface WorkspaceRendererProps {
  zone: WorkspaceZone;
}

const renderWorkspaceBody = (zone: WorkspaceZone): React.ReactNode => {
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

  let module = workspaceRegistry.getModule(zone.workspaceId);

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

  return React.createElement(module.component, {
    workspaceId: zone.workspaceId,
    zoneId: zone.id,
  });
};

const WorkspaceRendererComponent: React.FC<WorkspaceRendererProps> = ({ zone }) => {
  const zoneTitle = getWorkspaceDisplayNameRu(zone.workspaceType);
  const collectionBinding = useProjectStore((state) =>
    zone.workspaceType === 'collection' ? state.collectionBindings[zone.workspaceId] : undefined,
  );

  useEffect(() => {
    if (zone.workspaceType !== 'collection') return;
    const prepare = () => prepareWorkspaceInstance(zone);
    if (useProjectStore.persist.hasHydrated()) {
      prepare();
      return;
    }
    return useProjectStore.persist.onFinishHydration(prepare);
  }, [collectionBinding, zone]);

  return (
    <div className="workspace-zone">
      <div className="workspace-zone__eyebrow" title={zoneTitle}>
        {zoneTitle}
      </div>
      <div className="workspace-zone__body">{renderWorkspaceBody(zone)}</div>
    </div>
  );
};

export const WorkspaceRenderer = memo(WorkspaceRendererComponent);

WorkspaceRenderer.displayName = 'WorkspaceRenderer';
