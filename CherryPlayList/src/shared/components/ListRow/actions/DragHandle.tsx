import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import React from 'react';

import { useListRowContext } from '../ListRowContext';

/**
 * DragHandle - Handle for dragging items
 *
 * Hidden when the row is locked.
 */
export const DragHandle: React.FC = () => {
  const { baseClassName, isLocked } = useListRowContext();

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <button
      type="button"
      className={`${baseClassName}-drag-handle`}
      onClick={handleClick}
      aria-label="Drag item"
      style={{ visibility: isLocked ? 'hidden' : 'visible' }}
    >
      <DragIndicatorIcon className="drag-icon" />
    </button>
  );
};

DragHandle.displayName = 'ListRow.DragHandle';
