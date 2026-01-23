import React from 'react';

import { useListRowContext } from '../ListRowContext';

/**
 * Props for Content component
 */
export interface ContentProps {
  /** Content to display (usually the item name) */
  children: React.ReactNode;
  /** Additional CSS class name */
  className?: string;
  /** Whether the content is editable (for group names) */
  editable?: boolean;
  /** Called on double click (for editing) */
  onDoubleClick?: (e: React.MouseEvent) => void;
  /** Title/tooltip */
  title?: string;
}

/**
 * Content - Main content area for the row
 *
 * Displays the primary content (usually the item name).
 * Supports editable mode for group names.
 */
export const Content: React.FC<ContentProps> = ({
  children,
  className,
  editable = false,
  onDoubleClick,
  title,
}) => {
  const { baseClassName, isLocked } = useListRowContext();

  const computedClassName = [`${baseClassName}-name`, className].filter(Boolean).join(' ');

  const style: React.CSSProperties = {
    cursor: editable && !isLocked ? 'text' : 'default',
  };

  return (
    <div
      className={computedClassName}
      onDoubleClick={editable && !isLocked ? onDoubleClick : undefined}
      style={style}
      title={title}
    >
      {children}
    </div>
  );
};

Content.displayName = 'ListRow.Content';
