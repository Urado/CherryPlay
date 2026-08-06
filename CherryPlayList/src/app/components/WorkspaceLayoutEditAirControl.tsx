import AddIcon from '@mui/icons-material/Add';
import React, { useRef } from 'react';

import type { LayoutEditAirSide } from '@shared/utils/layoutWorkspaceOperations';

import type { WorkspacePickerOption } from './workspaceLayoutEditOptions';
import { useWorkspacePickerMenu, WorkspacePickerMenu } from './WorkspacePickerMenu';

interface WorkspaceLayoutEditAirControlProps {
  side: LayoutEditAirSide;
  options: WorkspacePickerOption[];
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  onSelectWorkspace: (workspaceType: string) => void;
  iconPlacement?: 'workspace-side' | 'band-center';
}

const AIR_SIDE_ARIA_LABELS: Record<LayoutEditAirSide, string> = {
  top: 'Добавить окно сверху',
  right: 'Добавить окно справа',
  bottom: 'Добавить окно снизу',
  left: 'Добавить окно слева',
};

export const WorkspaceLayoutEditAirControl: React.FC<WorkspaceLayoutEditAirControlProps> = ({
  side,
  options,
  isOpen,
  onToggle,
  onClose,
  onSelectWorkspace,
  iconPlacement = 'workspace-side',
}) => {
  const controlRef = useRef<HTMLButtonElement>(null);
  const iconRef = useRef<HTMLSpanElement>(null);
  const { listId, pickerPosition, syncPickerPosition } = useWorkspacePickerMenu({
    anchorRef: iconRef,
    controlRef,
    isOpen,
    onClose,
    placement: { kind: 'air-side', side },
  });

  const handleZoneClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();

    if (!isOpen) {
      syncPickerPosition();
    }

    onToggle();
  };

  const handleZoneKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (!isOpen) {
      syncPickerPosition();
    }

    onToggle();
  };

  return (
    <button
      ref={controlRef}
      type="button"
      className={`workspace-layout-edit-air-control workspace-layout-edit-air-control--${side} workspace-layout-edit-air-control--zone workspace-layout-edit-air-control--icon-${iconPlacement}`}
      onClick={handleZoneClick}
      onKeyDown={handleZoneKeyDown}
      aria-expanded={isOpen}
      aria-haspopup="menu"
      aria-controls={isOpen ? listId : undefined}
      aria-label={AIR_SIDE_ARIA_LABELS[side]}
      title={AIR_SIDE_ARIA_LABELS[side]}
    >
      <span ref={iconRef} className="workspace-layout-edit-add-icon" aria-hidden>
        <AddIcon fontSize="small" />
      </span>

      <WorkspacePickerMenu
        listId={listId}
        pickerPosition={pickerPosition}
        isOpen={isOpen}
        onClose={onClose}
        options={options}
        onSelect={onSelectWorkspace}
      />
    </button>
  );
};
