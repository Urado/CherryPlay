import CloseIcon from '@mui/icons-material/Close';
import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { getWorkspaceDisplayNameRu } from '@core/constants/workspaceDisplayNames';
import { WorkspaceZone, Zone } from '@core/types/layout';
import { useLayoutStore } from '@shared/stores';
import { getLayoutAirPickerKey } from '@shared/stores/layoutStore';
import { getCurrentLayoutViewport } from '@shared/utils/layoutViewportBridge';
import type { LayoutEditAirSide } from '@shared/utils/layoutWorkspaceOperations';
import {
  canAddAdjacentWorkspace,
  countWorkspaceLeaves,
  isSingletonWorkspaceType,
} from '@shared/utils/layoutWorkspaceOperations';

import { WorkspaceRenderer } from '../WorkspaceRenderer';

import { WorkspaceLayoutEditAirControl } from './WorkspaceLayoutEditAirControl';
import { AIR_DISABLED_HINT, getWorkspacePickerOptions } from './workspaceLayoutEditOptions';

interface WorkspaceLayoutEditShellProps {
  zone: WorkspaceZone;
}

interface ShellDimensions {
  width: number;
  height: number;
  airSize: number;
}

const AIR_SIDES: LayoutEditAirSide[] = ['top', 'right', 'bottom', 'left'];

function readShellDimensions(node: HTMLDivElement): ShellDimensions {
  const { width, height } = node.getBoundingClientRect();
  const airSizeRaw = getComputedStyle(node).getPropertyValue('--layout-edit-air-size').trim();
  const airSize = Number.parseFloat(airSizeRaw) || 24;

  return { width, height, airSize };
}

function buildCornerDiagonals({ width, height, airSize }: ShellDimensions) {
  if (width <= 0 || height <= 0 || airSize <= 0) {
    return [];
  }

  return [
    { x1: airSize, y1: airSize, x2: 0, y2: 0 },
    { x1: width - airSize, y1: airSize, x2: width, y2: 0 },
    { x1: width - airSize, y1: height - airSize, x2: width, y2: height },
    { x1: airSize, y1: height - airSize, x2: 0, y2: height },
  ];
}

function getRemoveWorkspaceConfirmMessage(zone: WorkspaceZone, rootZone: Zone): string | null {
  const displayName = getWorkspaceDisplayNameRu(zone.workspaceType);
  const isLastZone = countWorkspaceLeaves(rootZone) <= 1;
  const isSingleton = isSingletonWorkspaceType(zone.workspaceType);

  if (isLastZone) {
    return `Удалить последнее окно «${displayName}»? Рабочие окна станут пустыми.`;
  }

  if (isSingleton) {
    return `Удалить единственное окно «${displayName}» этого типа?`;
  }

  return null;
}

export const WorkspaceLayoutEditShell: React.FC<WorkspaceLayoutEditShellProps> = ({ zone }) => {
  const shellRef = useRef<HTMLDivElement>(null);
  const layout = useLayoutStore((state) => state.layout);
  const addAdjacentWorkspace = useLayoutStore((state) => state.addAdjacentWorkspace);
  const removeWorkspaceZone = useLayoutStore((state) => state.removeWorkspaceZone);
  const openLayoutEditPickerKey = useLayoutStore((state) => state.openLayoutEditPickerKey);
  const setOpenLayoutEditPickerKey = useLayoutStore((state) => state.setOpenLayoutEditPickerKey);
  const [dimensions, setDimensions] = useState<ShellDimensions>({
    width: 0,
    height: 0,
    airSize: 24,
  });

  const workspaceLabel = useMemo(
    () => getWorkspaceDisplayNameRu(zone.workspaceType),
    [zone.workspaceType],
  );
  const workspaceOptions = useMemo(() => getWorkspacePickerOptions(layout), [layout]);

  const availableSides = useMemo(() => {
    const resizeToken = dimensions.width * dimensions.height;
    void resizeToken;
    const viewport = getCurrentLayoutViewport();
    const workspaceTypes = workspaceOptions.map((option) => option.type);

    return AIR_SIDES.reduce<Record<LayoutEditAirSide, boolean>>(
      (acc, side) => {
        acc[side] = canAddAdjacentWorkspace(layout, zone.id, side, workspaceTypes, viewport);
        return acc;
      },
      { top: false, right: false, bottom: false, left: false },
    );
  }, [layout, zone.id, workspaceOptions, dimensions.width, dimensions.height]);

  const handleSelectWorkspace = useCallback(
    (side: LayoutEditAirSide, workspaceType: string) => {
      addAdjacentWorkspace(zone.id, side, workspaceType);
    },
    [addAdjacentWorkspace, zone.id],
  );

  const handleRemoveWorkspace = useCallback(() => {
    const confirmMessage = getRemoveWorkspaceConfirmMessage(zone, layout.rootZone);
    if (confirmMessage && !window.confirm(confirmMessage)) {
      return;
    }

    removeWorkspaceZone(zone.id);
  }, [layout.rootZone, removeWorkspaceZone, zone]);

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

  const cornerDiagonals = buildCornerDiagonals(dimensions);

  return (
    <div
      ref={shellRef}
      className="workspace-layout-edit-shell"
      aria-label={`Редактирование: ${workspaceLabel}`}
    >
      {AIR_SIDES.map((side) => {
        const canAdd = availableSides[side];

        return (
          <div
            key={side}
            className={`workspace-layout-edit-air workspace-layout-edit-air--${side}${canAdd ? '' : ' workspace-layout-edit-air--disabled'}`}
          >
            {canAdd ? (
              <WorkspaceLayoutEditAirControl
                side={side}
                options={workspaceOptions}
                isOpen={openLayoutEditPickerKey === getLayoutAirPickerKey(zone.id, side)}
                onToggle={() => {
                  const pickerKey = getLayoutAirPickerKey(zone.id, side);
                  setOpenLayoutEditPickerKey(
                    openLayoutEditPickerKey === pickerKey ? null : pickerKey,
                  );
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
      })}

      {cornerDiagonals.length > 0 && (
        <svg
          className="workspace-layout-edit-dividers"
          width={dimensions.width}
          height={dimensions.height}
          aria-hidden="true"
        >
          {cornerDiagonals.map((line, index) => (
            <line
              key={index}
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
              className="workspace-layout-edit-dividers__line"
            />
          ))}
        </svg>
      )}

      <div className="workspace-layout-edit-content-frame" aria-hidden="true" />

      <button
        type="button"
        className="workspace-layout-edit-close"
        title={`Удалить «${workspaceLabel}»`}
        aria-label={`Удалить «${workspaceLabel}»`}
        onClick={handleRemoveWorkspace}
      >
        <CloseIcon fontSize="small" aria-hidden />
      </button>

      <div className="workspace-layout-edit-content" inert>
        <WorkspaceRenderer zone={zone} />
        <div className="workspace-layout-edit-overlay" aria-hidden="true" />
      </div>
    </div>
  );
};
