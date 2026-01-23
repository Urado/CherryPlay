import React from 'react';

import { useItemListContext } from './ItemListContext';

/**
 * Props for DropIndicator component
 */
export interface DropIndicatorProps {
  /** The index where this indicator should appear */
  index: number;
  /** Additional CSS class name */
  className?: string;
}

/**
 * DropIndicator - Visual indicator for drop position
 *
 * Renders a horizontal line at the drop position during drag operations.
 * Should be rendered between items based on the current dropIndex from context.
 *
 * @example
 * ```tsx
 * {items.map((item, index) => (
 *   <React.Fragment key={item.id}>
 *     <DropIndicator index={index} />
 *     <ListRow id={item.id}>...</ListRow>
 *   </React.Fragment>
 * ))}
 * <DropIndicator index={items.length} />
 * ```
 */
export const DropIndicator: React.FC<DropIndicatorProps> = ({ index, className }) => {
  const { dropIndex, isDragging, baseClassName } = useItemListContext();

  // Only show if dragging and this is the drop position
  if (!isDragging || dropIndex !== index) {
    return null;
  }

  const computedClassName = [`${baseClassName}-drop-indicator`, 'drag-insert-line', className]
    .filter(Boolean)
    .join(' ');

  return <div className={computedClassName} aria-hidden="true" />;
};

DropIndicator.displayName = 'ItemList.DropIndicator';

/**
 * Standalone DropIndicator that doesn't rely on context
 * Useful when you need more control over when to show the indicator
 */
export interface StandaloneDropIndicatorProps {
  /** Whether to show the indicator */
  show: boolean;
  /** Additional CSS class name */
  className?: string;
}

export const StandaloneDropIndicator: React.FC<StandaloneDropIndicatorProps> = ({
  show,
  className,
}) => {
  if (!show) {
    return null;
  }

  const computedClassName = ['drag-insert-line', className].filter(Boolean).join(' ');

  return <div className={computedClassName} aria-hidden="true" />;
};

StandaloneDropIndicator.displayName = 'StandaloneDropIndicator';
