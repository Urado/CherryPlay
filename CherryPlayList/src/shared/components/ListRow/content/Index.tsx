import React from 'react';

import { useListRowContext } from '../ListRowContext';

/**
 * Props for Index component
 */
export interface IndexProps {
  /** The index value to display (0-based, will be displayed as 1-based) */
  value?: number;
  /** Custom content to display instead of index */
  children?: React.ReactNode;
  /** Whether to reserve space even when not showing index */
  reserveSpace?: boolean;
}

/**
 * Index - Displays the row index/number
 *
 * Can display a numeric index or custom content (e.g., ungroup button for groups).
 * Supports reserving space for alignment when index is not shown.
 */
export const Index: React.FC<IndexProps> = ({ value, children, reserveSpace = true }) => {
  const { baseClassName } = useListRowContext();

  // If we have custom children, render them
  if (children) {
    return <div className={`${baseClassName}-index`}>{children}</div>;
  }

  // If we have a valid index value, show it (1-based)
  if (value !== undefined && value >= 0) {
    return <div className={`${baseClassName}-index`}>{value + 1}</div>;
  }

  // If reserveSpace is true, render an invisible placeholder
  if (reserveSpace) {
    return (
      <div className={`${baseClassName}-index`} style={{ visibility: 'hidden' }}>
        {'\u200B'}
      </div>
    );
  }

  return null;
};

Index.displayName = 'ListRow.Index';
