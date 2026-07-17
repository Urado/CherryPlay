import DeleteIcon from '@mui/icons-material/Delete';
import React from 'react';

import { useListRowContext } from '../ListRowContext';

import { ActionButton } from './ActionButton';

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
  const { baseClassName } = useListRowContext();

  return (
    <ActionButton
      onClick={() => onClick?.()}
      className={`${baseClassName}-delete`}
      aria-label="Delete item"
      hideWhenLocked
      icon={<DeleteIcon />}
      variant="ghost"
      size="sm"
      tone="danger"
      hoverable={false}
      filled="hover"
    />
  );
};

DeleteButton.displayName = 'ListRow.DeleteButton';
