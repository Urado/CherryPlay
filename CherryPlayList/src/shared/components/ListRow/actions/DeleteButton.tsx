import DeleteIcon from '@mui/icons-material/Delete';
import React from 'react';

import { useListRowContext } from '../ListRowContext';

import { ActionButton } from './ActionButton';

export interface DeleteButtonProps {
  onClick?: () => void;
}

export const DeleteButton: React.FC<DeleteButtonProps> = ({ onClick }) => {
  const { baseClassName } = useListRowContext();

  return (
    <ActionButton
      onClick={() => onClick?.()}
      className={`${baseClassName}-delete`}
      aria-label="Удалить"
      hideWhenLocked
      icon={<DeleteIcon />}
      variant="ghost"
      size="sm"
      tone="neutral"
      hoverable={false}
      filled="hover"
    />
  );
};

DeleteButton.displayName = 'ListRow.DeleteButton';
