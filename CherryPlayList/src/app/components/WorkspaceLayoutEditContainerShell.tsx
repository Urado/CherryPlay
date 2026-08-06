import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { ContainerZone } from '@core/types/layout';
import { useLayoutStore } from '@shared/stores';
import { getLayoutContainerAirPickerKey } from '@shared/stores/layoutStore';
import { getCurrentLayoutViewport } from '@shared/utils/layoutViewportBridge';
import type { LayoutEditAirSide } from '@shared/utils/layoutWorkspaceOperations';
import {
  canAddAdjacentWorkspaceToContainer,
  getContainerSpanSides,
} from '@shared/utils/layoutWorkspaceOperations';

import { WorkspaceLayoutEditAirControl } from './WorkspaceLayoutEditAirControl';
import { AIR_DISABLED_HINT, getWorkspacePickerOptions } from './workspaceLayoutEditOptions';

interface WorkspaceLayoutEditContainerShellProps {
  zone: ContainerZone;
  children: React.ReactNode;
}

interface ShellDimensions {
  width: number;
  height: number;
}

function readShellDimensions(node: HTMLDivElement): ShellDimensions {
  const { width, height } = node.getBoundingClientRect();
  return { width, height };
}

export const WorkspaceLayoutEditContainerShell: React.FC<
  WorkspaceLayoutEditContainerShellProps
> = ({ zone, children }) => {
  const shellRef = useRef<HTMLDivElement>(null);
  const layout = useLayoutStore((state) => state.layout);
  const addAdjacentWorkspaceToContainer = useLayoutStore(
    (state) => state.addAdjacentWorkspaceToContainer,
  );
  const openLayoutEditPickerKey = useLayoutStore((state) => state.openLayoutEditPickerKey);
  const setOpenLayoutEditPickerKey = useLayoutStore((state) => state.setOpenLayoutEditPickerKey);
  const [dimensions, setDimensions] = useState<ShellDimensions>({ width: 0, height: 0 });

  const spanSides = useMemo(() => getContainerSpanSides(zone.direction), [zone.direction]);
  const workspaceOptions = useMemo(() => getWorkspacePickerOptions(layout), [layout]);
  const isHorizontal = zone.direction === 'horizontal';
  const workspaceTypes = useMemo(
    () => workspaceOptions.map((option) => option.type),
    [workspaceOptions],
  );

  const availableSides = useMemo(() => {
    const resizeToken = dimensions.width * dimensions.height;
    void resizeToken;
    const viewport = getCurrentLayoutViewport();

    return spanSides.reduce<Record<LayoutEditAirSide, boolean>>(
      (acc, side) => {
        acc[side] = canAddAdjacentWorkspaceToContainer(
          layout,
          zone.id,
          side,
          workspaceTypes,
          viewport,
        );
        return acc;
      },
      { top: false, right: false, bottom: false, left: false },
    );
  }, [layout, spanSides, workspaceTypes, zone.id, dimensions.width, dimensions.height]);

  const handleSelectWorkspace = useCallback(
    (side: LayoutEditAirSide, workspaceType: string) => {
      addAdjacentWorkspaceToContainer(zone.id, side, workspaceType);
    },
    [addAdjacentWorkspaceToContainer, zone.id],
  );

  useLayoutEffect(() => {
    const node = shellRef.current;
    if (!node) {
      return;
    }

    const updateDimensions = () => {
      setDimensions(readShellDimensions(node));
    };

    updateDimensions();

    const observer = new ResizeObserver(updateDimensions);
    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  const renderAirBand = (side: LayoutEditAirSide) => {
    const canAdd = availableSides[side];

    return (
      <div
        key={side}
        className={`workspace-layout-edit-container-air workspace-layout-edit-container-air--${side}${canAdd ? '' : ' workspace-layout-edit-container-air--disabled'}`}
      >
        {canAdd ? (
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
        ) : (
          <button
            type="button"
            className="workspace-layout-edit-air-control workspace-layout-edit-air-control--zone"
            disabled
            aria-disabled="true"
            aria-label={AIR_DISABLED_HINT}
            title={AIR_DISABLED_HINT}
          />
        )}
      </div>
    );
  };

  if (isHorizontal) {
    return (
      <div
        ref={shellRef}
        className="workspace-layout-edit-container-shell workspace-layout-edit-container-shell--horizontal"
      >
        {spanSides.includes('top') && renderAirBand('top')}
        <div className="workspace-layout-edit-container-shell__content">{children}</div>
        {spanSides.includes('bottom') && renderAirBand('bottom')}
      </div>
    );
  }

  return (
    <div
      ref={shellRef}
      className="workspace-layout-edit-container-shell workspace-layout-edit-container-shell--vertical"
    >
      {spanSides.includes('left') && renderAirBand('left')}
      <div className="workspace-layout-edit-container-shell__content">{children}</div>
      {spanSides.includes('right') && renderAirBand('right')}
    </div>
  );
};
