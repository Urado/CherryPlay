import React from 'react';

import { useListRowContext } from '../ListRowContext';

/**
 * Props for Secondary component
 */
export interface SecondaryProps {
  /** Content to display (usually duration, file size, etc.) */
  children?: React.ReactNode;
  /** Additional CSS class name */
  className?: string;
}

/**
 * Secondary - Secondary content area for the row
 *
 * Displays secondary information like duration, file size, etc.
 */
export const Secondary: React.FC<SecondaryProps> = ({ children, className }) => {
  const { baseClassName } = useListRowContext();

  if (!children) {
    return null;
  }

  const computedClassName = [`${baseClassName}-duration`, className].filter(Boolean).join(' ');

  return <div className={computedClassName}>{children}</div>;
};

Secondary.displayName = 'ListRow.Secondary';
