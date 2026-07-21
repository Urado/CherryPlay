import BlockIcon from '@mui/icons-material/Block';
import React from 'react';

import { useListRowContext } from '../ListRowContext';

import { ActionButton } from './ActionButton';

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

  return (
    <ActionButton
      onClick={() => onToggle?.()}
      className={`${baseClassName}-disable`}
      title={isDisabled ? 'Enable' : 'Disable'}
      aria-label={isDisabled ? 'Enable' : 'Disable'}
      icon={<BlockIcon style={{ fontSize: '18px' }} />}
      variant="ghost"
      size="sm"
    />
  );
};

DisableButton.displayName = 'ListRow.DisableButton';
