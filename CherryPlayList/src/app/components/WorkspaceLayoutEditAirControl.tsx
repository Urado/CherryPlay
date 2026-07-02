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
}

export const WorkspaceLayoutEditAirControl: React.FC<WorkspaceLayoutEditAirControlProps> = ({
  side,
  options,
  isOpen,
  onToggle,
  onClose,
  onSelectWorkspace,
}) => {
  const controlRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const { listId, pickerPosition, syncPickerPosition } = useWorkspacePickerMenu({
    anchorRef: buttonRef,
    controlRef,
    isOpen,
    onClose,
    placement: { kind: 'air-side', side },
  });

  const handleToggleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();

    if (!isOpen) {
      syncPickerPosition();
    }

    onToggle();
  };

  return (
    <div
      ref={controlRef}
      className={`workspace-layout-edit-air-control workspace-layout-edit-air-control--${side}`}
    >
      <button
        ref={buttonRef}
        type="button"
        className="workspace-layout-edit-add-btn"
        onClick={handleToggleClick}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-controls={isOpen ? listId : undefined}
        title="Добавить workspace"
      >
        <AddIcon fontSize="small" aria-hidden />
      </button>

      <WorkspacePickerMenu
        listId={listId}
        pickerPosition={pickerPosition}
        isOpen={isOpen}
        onClose={onClose}
        options={options}
        onSelect={onSelectWorkspace}
      />
    </div>
  );
};
