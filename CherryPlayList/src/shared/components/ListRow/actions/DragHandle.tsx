import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import React from 'react';

import { useListRowContext } from '../ListRowContext';

import { ActionButton } from './ActionButton';

/**
 * DragHandle - Handle for dragging items
 *
 * Hidden when the row is locked.
 */
export const DragHandle: React.FC = () => {
  const { baseClassName } = useListRowContext();

  return (
    <ActionButton
      onClick={() => undefined}
      className={`${baseClassName}-drag-handle`}
      aria-label="Drag item"
      hideWhenLocked
      icon={<DragIndicatorIcon className="drag-icon" />}
      variant="ghost"
      size="sm"
      borderless
    />
  );
};

DragHandle.displayName = 'ListRow.DragHandle';
