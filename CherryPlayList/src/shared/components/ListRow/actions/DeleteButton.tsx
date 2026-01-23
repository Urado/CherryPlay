import DeleteIcon from '@mui/icons-material/Delete';
import React from 'react';

import { useListRowContext } from '../ListRowContext';

/**
 * Props for DeleteButton component
 */
export interface DeleteButtonProps {
  /** Called when delete is clicked */
  onClick?: () => void;
}

/**
 * DeleteButton - Delete button for removing items
 *
 * Hidden when the row is locked.
 */
export const DeleteButton: React.FC<DeleteButtonProps> = ({ onClick }) => {
  const { baseClassName, isLocked } = useListRowContext();

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isLocked && onClick) {
      onClick();
    }
  };

  return (
    <button
      type="button"
      className={`${baseClassName}-delete`}
      onClick={handleClick}
      aria-label="Delete item"
      style={{ visibility: isLocked ? 'hidden' : 'visible' }}
    >
      <DeleteIcon />
    </button>
  );
};

DeleteButton.displayName = 'ListRow.DeleteButton';
