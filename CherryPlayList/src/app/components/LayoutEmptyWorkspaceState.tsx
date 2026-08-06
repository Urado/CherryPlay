import AddIcon from '@mui/icons-material/Add';
import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';

import { useLayoutStore } from '@shared/stores';
import { LAYOUT_EMPTY_PICKER_KEY } from '@shared/stores/layoutStore';
import { getCurrentLayoutViewport } from '@shared/utils/layoutViewportBridge';
import { canAddInitialWorkspace } from '@shared/utils/layoutWorkspaceOperations';

import { AIR_DISABLED_HINT, getWorkspacePickerOptions } from './workspaceLayoutEditOptions';
import { useWorkspacePickerMenu, WorkspacePickerMenu } from './WorkspacePickerMenu';

export const LayoutEmptyWorkspaceState: React.FC = () => {
  const layout = useLayoutStore((state) => state.layout);
  const addInitialWorkspace = useLayoutStore((state) => state.addInitialWorkspace);
  const openLayoutEditPickerKey = useLayoutStore((state) => state.openLayoutEditPickerKey);
  const setOpenLayoutEditPickerKey = useLayoutStore((state) => state.setOpenLayoutEditPickerKey);
  const rootRef = useRef<HTMLDivElement>(null);
  const controlRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [viewportToken, setViewportToken] = useState(0);

  const isOpen = openLayoutEditPickerKey === LAYOUT_EMPTY_PICKER_KEY;
  const options = useMemo(() => getWorkspacePickerOptions(layout), [layout]);
  const canAddAny = useMemo(() => {
    void viewportToken;
    const viewport = getCurrentLayoutViewport();
    return options.some((option) => canAddInitialWorkspace(option.type, viewport));
  }, [options, viewportToken]);
  const { listId, pickerPosition, syncPickerPosition } = useWorkspacePickerMenu({
    anchorRef: buttonRef,
    controlRef,
    isOpen,
    onClose: () => setOpenLayoutEditPickerKey(null),
    placement: { kind: 'below-center' },
  });

  useLayoutEffect(() => {
    const node = rootRef.current;
    if (!node) {
      return;
    }

    const bumpToken = () => setViewportToken((token) => token + 1);
    bumpToken();

    const observer = new ResizeObserver(bumpToken);
    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={rootRef} className="layout-empty-workspace-state">
      <div ref={controlRef} className="layout-empty-workspace-state__control">
        <button
          ref={buttonRef}
          type="button"
          className="workspace-layout-edit-add-btn"
          disabled={!canAddAny}
          aria-disabled={!canAddAny}
          onClick={() => {
            if (!isOpen) {
              syncPickerPosition();
            }
            setOpenLayoutEditPickerKey(isOpen ? null : LAYOUT_EMPTY_PICKER_KEY);
          }}
          aria-expanded={isOpen}
          aria-haspopup="menu"
          aria-controls={isOpen ? listId : undefined}
          title={canAddAny ? 'Добавить окно' : AIR_DISABLED_HINT}
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
