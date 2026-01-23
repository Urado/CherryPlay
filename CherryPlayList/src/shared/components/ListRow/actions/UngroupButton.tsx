import CallSplitIcon from '@mui/icons-material/CallSplit';
import React from 'react';

import { useListRowContext } from '../ListRowContext';

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
  const { baseClassName, isLocked } = useListRowContext();

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isLocked) {
      onUngroup();
    }
  };

  return (
    <button
      type="button"
      className={`${baseClassName}-ungroup`}
      onClick={handleClick}
      disabled={isLocked}
      title={title}
      aria-label={title}
      style={{ visibility: isLocked ? 'hidden' : 'visible' }}
    >
      <CallSplitIcon style={{ fontSize: '18px' }} />
    </button>
  );
};

UngroupButton.displayName = 'ListRow.UngroupButton';
