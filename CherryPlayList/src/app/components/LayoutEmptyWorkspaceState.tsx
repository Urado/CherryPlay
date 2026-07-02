import AddIcon from '@mui/icons-material/Add';
import React, { useMemo, useRef } from 'react';

import { useLayoutStore } from '@shared/stores';
import { LAYOUT_EMPTY_PICKER_KEY } from '@shared/stores/layoutStore';

import { getWorkspacePickerOptions } from './workspaceLayoutEditOptions';
import { useWorkspacePickerMenu, WorkspacePickerMenu } from './WorkspacePickerMenu';

export const LayoutEmptyWorkspaceState: React.FC = () => {
  const layout = useLayoutStore((state) => state.layout);
  const addInitialWorkspace = useLayoutStore((state) => state.addInitialWorkspace);
  const openLayoutEditPickerKey = useLayoutStore((state) => state.openLayoutEditPickerKey);
  const setOpenLayoutEditPickerKey = useLayoutStore((state) => state.setOpenLayoutEditPickerKey);
  const controlRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const isOpen = openLayoutEditPickerKey === LAYOUT_EMPTY_PICKER_KEY;
  const options = useMemo(() => getWorkspacePickerOptions(layout), [layout]);
  const { listId, pickerPosition, syncPickerPosition } = useWorkspacePickerMenu({
    anchorRef: buttonRef,
    controlRef,
    isOpen,
    onClose: () => setOpenLayoutEditPickerKey(null),
    placement: { kind: 'below-center' },
  });

  return (
    <div className="layout-empty-workspace-state">
      <div ref={controlRef} className="layout-empty-workspace-state__control">
        <button
          ref={buttonRef}
          type="button"
          className="workspace-layout-edit-add-btn"
          onClick={() => {
            if (!isOpen) {
              syncPickerPosition();
            }
            setOpenLayoutEditPickerKey(isOpen ? null : LAYOUT_EMPTY_PICKER_KEY);
          }}
          aria-expanded={isOpen}
          aria-haspopup="menu"
          aria-controls={isOpen ? listId : undefined}
          title="Добавить workspace"
        >
          <AddIcon fontSize="small" aria-hidden />
        </button>
      </div>
      <WorkspacePickerMenu
        listId={listId}
        pickerPosition={pickerPosition}
        isOpen={isOpen}
        onClose={() => setOpenLayoutEditPickerKey(null)}
        options={options}
        onSelect={addInitialWorkspace}
      />
    </div>
  );
};
