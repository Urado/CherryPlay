import React, { useCallback, useMemo } from 'react';

import { ContainerZone } from '@core/types/layout';
import { useLayoutStore } from '@shared/stores';
import { getLayoutContainerAirPickerKey } from '@shared/stores/layoutStore';
import type { LayoutEditAirSide } from '@shared/utils/layoutWorkspaceOperations';
import { getContainerSpanSides } from '@shared/utils/layoutWorkspaceOperations';

import { WorkspaceLayoutEditAirControl } from './WorkspaceLayoutEditAirControl';
import { getWorkspacePickerOptions } from './workspaceLayoutEditOptions';

interface WorkspaceLayoutEditContainerShellProps {
  zone: ContainerZone;
  children: React.ReactNode;
}

export const WorkspaceLayoutEditContainerShell: React.FC<
  WorkspaceLayoutEditContainerShellProps
> = ({ zone, children }) => {
  const layout = useLayoutStore((state) => state.layout);
  const addAdjacentWorkspaceToContainer = useLayoutStore(
    (state) => state.addAdjacentWorkspaceToContainer,
  );
  const openLayoutEditPickerKey = useLayoutStore((state) => state.openLayoutEditPickerKey);
  const setOpenLayoutEditPickerKey = useLayoutStore((state) => state.setOpenLayoutEditPickerKey);

  const spanSides = useMemo(() => getContainerSpanSides(zone.direction), [zone.direction]);
  const workspaceOptions = useMemo(() => getWorkspacePickerOptions(layout), [layout]);
  const isHorizontal = zone.direction === 'horizontal';

  const handleSelectWorkspace = useCallback(
    (side: LayoutEditAirSide, workspaceType: string) => {
      addAdjacentWorkspaceToContainer(zone.id, side, workspaceType);
    },
    [addAdjacentWorkspaceToContainer, zone.id],
  );

  const renderAirBand = (side: LayoutEditAirSide) => (
    <div
      key={side}
      className={`workspace-layout-edit-container-air workspace-layout-edit-container-air--${side}`}
    >
      <WorkspaceLayoutEditAirControl
        side={side}
        iconPlacement="band-center"
        options={workspaceOptions}
        isOpen={openLayoutEditPickerKey === getLayoutContainerAirPickerKey(zone.id, side)}
        onToggle={() => {
          const pickerKey = getLayoutContainerAirPickerKey(zone.id, side);
          setOpenLayoutEditPickerKey(openLayoutEditPickerKey === pickerKey ? null : pickerKey);
        }}
        onClose={() => setOpenLayoutEditPickerKey(null)}
        onSelectWorkspace={(workspaceType) => handleSelectWorkspace(side, workspaceType)}
      />
    </div>
  );

  if (isHorizontal) {
    return (
      <div className="workspace-layout-edit-container-shell workspace-layout-edit-container-shell--horizontal">
        {spanSides.includes('top') && renderAirBand('top')}
        <div className="workspace-layout-edit-container-shell__content">{children}</div>
        {spanSides.includes('bottom') && renderAirBand('bottom')}
      </div>
    );
  }

  return (
    <div className="workspace-layout-edit-container-shell workspace-layout-edit-container-shell--vertical">
      {spanSides.includes('left') && renderAirBand('left')}
      <div className="workspace-layout-edit-container-shell__content">{children}</div>
      {spanSides.includes('right') && renderAirBand('right')}
    </div>
  );
};
