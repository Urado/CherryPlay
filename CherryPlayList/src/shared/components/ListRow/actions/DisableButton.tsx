import BlockIcon from '@mui/icons-material/Block';
import React from 'react';

import { useListRowContext } from '../ListRowContext';

/**
 * Props for DisableButton component
 */
export interface DisableButtonProps {
  /** Called when disable/enable is clicked */
  onToggle?: () => void;
}

/**
 * DisableButton - Button to disable/enable items
 *
 * Used in session mode to temporarily disable tracks.
 */
export const DisableButton: React.FC<DisableButtonProps> = ({ onToggle }) => {
  const { baseClassName, isDisabled } = useListRowContext();

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggle?.();
  };

  return (
    <button
      type="button"
      className={`${baseClassName}-disable`}
      onClick={handleClick}
      title={isDisabled ? 'Enable' : 'Disable'}
      aria-label={isDisabled ? 'Enable' : 'Disable'}
    >
      <BlockIcon style={{ fontSize: '18px' }} />
    </button>
  );
};

DisableButton.displayName = 'ListRow.DisableButton';
