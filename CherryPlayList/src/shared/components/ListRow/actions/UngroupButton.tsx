import CallSplitIcon from '@mui/icons-material/CallSplit';
import React from 'react';

import { useListRowContext } from '../ListRowContext';

import { ActionButton } from './ActionButton';

/**
 * Props for UngroupButton component
 */
export interface UngroupButtonProps {
  /** Called when ungroup is clicked */
  onUngroup: () => void;
  /** Custom title for the button */
  title?: string;
}

/**
 * UngroupButton - Button to ungroup/split a group
 *
 * Displays a split icon button. Hidden when the row is locked.
 */
export const UngroupButton: React.FC<UngroupButtonProps> = ({
  onUngroup,
  title = 'Расформировать группу',
}) => {
  const { baseClassName } = useListRowContext();

  return (
    <ActionButton
      onClick={onUngroup}
      className={`${baseClassName}-ungroup`}
      title={title}
      aria-label={title}
      hideWhenLocked
      icon={<CallSplitIcon style={{ fontSize: '18px' }} />}
      variant="ghost"
      size="sm"
    />
  );
};

UngroupButton.displayName = 'ListRow.UngroupButton';
