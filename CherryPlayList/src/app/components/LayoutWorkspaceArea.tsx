import React from 'react';

import { ContainerZone, WorkspaceZone } from '@core/types/layout';
import { useLayoutStore } from '@shared/stores';
import { isLayoutEmpty } from '@shared/utils/layoutWorkspaceOperations';

import { WorkspaceRenderer } from '../WorkspaceRenderer';

import { LayoutEmptyWorkspaceState } from './LayoutEmptyWorkspaceState';
import { SplitContainer } from './SplitContainer';
import { WorkspaceLayoutEditShell } from './WorkspaceLayoutEditShell';

export const LayoutWorkspaceArea: React.FC = () => {
  const layout = useLayoutStore((state) => state.layout);
  const isLayoutEditMode = useLayoutStore((state) => state.isLayoutEditMode);

  if (isLayoutEmpty(layout)) {
    if (isLayoutEditMode) {
      return <LayoutEmptyWorkspaceState />;
    }

    return (
      <div className="layout-empty-workspace-state layout-empty-workspace-state--placeholder">
        <div className="layout-empty-workspace-state__placeholder-copy">
          <p className="layout-empty-workspace-state__placeholder-text">Нет рабочих окон</p>
          <p className="layout-empty-workspace-state__placeholder-hint">
            Нажмите «Настроить окна» ✎ в шапке, чтобы добавить окно
          </p>
        </div>
      </div>
    );
  }

  if (layout.rootZone.type === 'workspace') {
    const zone = layout.rootZone as WorkspaceZone;

    return (
      <div className="layout-workspace-root">
        {isLayoutEditMode ? (
          <WorkspaceLayoutEditShell zone={zone} />
        ) : (
          <WorkspaceRenderer zone={zone} />
        )}
      </div>
    );
  }

  return <SplitContainer zone={layout.rootZone as ContainerZone} />;
};
