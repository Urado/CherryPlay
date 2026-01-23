import React from 'react';

import { useListRowContext } from './ListRowContext';

/**
 * Props for Actions component
 */
export interface ActionsProps {
  /** Action buttons to display */
  children: React.ReactNode;
  /** Additional CSS class name */
  className?: string;
}

/**
 * Actions - Container for action buttons on the right side of the row
 *
 * Groups action buttons together with consistent spacing.
 */
export const Actions: React.FC<ActionsProps> = ({ children, className }) => {
  const { baseClassName } = useListRowContext();

  const computedClassName = [`${baseClassName}-actions`, className].filter(Boolean).join(' ');

  return <div className={computedClassName}>{children}</div>;
};

Actions.displayName = 'ListRow.Actions';
