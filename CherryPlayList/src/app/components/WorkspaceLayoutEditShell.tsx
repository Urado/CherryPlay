import CloseIcon from '@mui/icons-material/Close';
import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { WorkspaceZone } from '@core/types/layout';
import { useLayoutStore } from '@shared/stores';
import { getLayoutAirPickerKey } from '@shared/stores/layoutStore';
import type { LayoutEditAirSide } from '@shared/utils/layoutWorkspaceOperations';

import { WorkspaceRenderer } from '../WorkspaceRenderer';

import { WorkspaceLayoutEditAirControl } from './WorkspaceLayoutEditAirControl';
import { getWorkspacePickerOptions } from './workspaceLayoutEditOptions';

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
  const airSize = Number.parseFloat(airSizeRaw) || 48;

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

/**
 * Edit-mode frame around a workspace: four "air" regions (top/right/bottom/left)
 * separated by diagonals from workspace corners, plus a dimmed content area.
 */
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
    airSize: 48,
  });

  const workspaceOptions = useMemo(() => getWorkspacePickerOptions(layout), [layout]);

  const handleSelectWorkspace = useCallback(
    (side: LayoutEditAirSide, workspaceType: string) => {
      addAdjacentWorkspace(zone.id, side, workspaceType);
    },
    [addAdjacentWorkspace, zone.id],
  );

  const handleRemoveWorkspace = useCallback(() => {
    removeWorkspaceZone(zone.id);
  }, [removeWorkspaceZone, zone.id]);

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
    <div ref={shellRef} className="workspace-layout-edit-shell">
      {AIR_SIDES.map((side) => (
        <div key={side} className={`workspace-layout-edit-air workspace-layout-edit-air--${side}`}>
          <WorkspaceLayoutEditAirControl
            side={side}
            options={workspaceOptions}
            isOpen={openLayoutEditPickerKey === getLayoutAirPickerKey(zone.id, side)}
            onToggle={() => {
              const pickerKey = getLayoutAirPickerKey(zone.id, side);
              setOpenLayoutEditPickerKey(openLayoutEditPickerKey === pickerKey ? null : pickerKey);
            }}
            onClose={() => setOpenLayoutEditPickerKey(null)}
            onSelectWorkspace={(workspaceType) => handleSelectWorkspace(side, workspaceType)}
          />
        </div>
      ))}

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

      <button
        type="button"
        className="workspace-layout-edit-close"
        title="Удалить workspace"
        aria-label="Удалить workspace"
        onClick={handleRemoveWorkspace}
      >
        <CloseIcon fontSize="small" aria-hidden />
      </button>

      <div className="workspace-layout-edit-content" aria-hidden="true">
        <WorkspaceRenderer zone={zone} />
        <div className="workspace-layout-edit-overlay" aria-hidden="true" />
      </div>
    </div>
  );
};
