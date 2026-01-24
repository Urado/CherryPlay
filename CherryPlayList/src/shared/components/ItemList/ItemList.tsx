import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { WorkspaceId } from '@core/types/workspace';

import { useDragDropStore } from '../../stores/dragDropStore';

import { ItemListContextValue, ItemListProvider } from './ItemListContext';

export interface ItemListProps {
  children: React.ReactNode;
  baseClassName?: string;
  className?: string;
  style?: React.CSSProperties;
  workspaceId?: WorkspaceId;
  /** Container drag over handler - receives event only (new API) */
  onDragOver?: (e: React.DragEvent) => void;
  /** Container drop handler - receives event only (new API) */
  onDrop?: (e: React.DragEvent) => void;
  onDragLeave?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  showEmptyState?: boolean;
  emptyState?: React.ReactNode;
}

/**
 * ItemList - Container component with drop logic on the container level
 *
 * Handles drag and drop at the container level, solving the "dead zone" bug
 * where drops between items don't work. The drop position is calculated
 * based on cursor position relative to all items.
 *
 * @example
 * ```tsx
 * <ItemList
 *   onDragOver={handleDragOverContainer}
 *   onDrop={handleDropOnContainer}
 *   onDragLeave={handleDragLeave}
 * >
 *   {items.map((item, index) => (
 *     <ListRow key={item.id} id={item.id}>
 *       ...
 *     </ListRow>
 *   ))}
 * </ItemList>
 * ```
 */
export const ItemList: React.FC<ItemListProps> = ({
  children,
  baseClassName = 'item-list',
  className,
  style,
  workspaceId,
  onDragOver,
  onDrop,
  onDragLeave,
  onDragEnd,
  showEmptyState = true,
  emptyState,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const hoverWorkspaceId = useDragDropStore((state) => state.hoverWorkspaceId);
  const globalDragging = useDragDropStore((state) => state.dragging);

  useEffect(() => {
    if (!globalDragging) {
      // Reset state when dragging stops - using setTimeout to avoid synchronous setState in effect
      setTimeout(() => {
        setDropIndex(null);
        setIsDragging(false);
      }, 0);
      return;
    }
    if (workspaceId && hoverWorkspaceId !== null && hoverWorkspaceId !== workspaceId) {
      setTimeout(() => {
        setDropIndex(null);
        setIsDragging(false);
      }, 0);
    }
  }, [hoverWorkspaceId, workspaceId, globalDragging]);

  /**
   * Calculate the insert index based on cursor position
   * This is the key logic that solves the "dead zone" bug
   */
  const calculateInsertIndex = useCallback((e: React.DragEvent): number => {
    const container = containerRef.current;
    if (!container) return 0;

    const items = container.querySelectorAll('[data-item-id]');
    if (items.length === 0) return 0;

    // Default to end of list
    let insertIndex = items.length;

    for (let i = 0; i < items.length; i++) {
      const rect = items[i].getBoundingClientRect();
      const midY = rect.top + rect.height / 2;

      if (e.clientY < midY) {
        insertIndex = i;
        break;
      }
    }

    return insertIndex;
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      setIsDragging(true);
      const insertIndex = calculateInsertIndex(e);
      setDropIndex(insertIndex);

      // Call callback with just the event (new API)
      onDragOver?.(e);
    },
    [calculateInsertIndex, onDragOver],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Call callback with just the event (new API)
      onDrop?.(e);

      setDropIndex(null);
      setIsDragging(false);
    },
    [onDrop],
  );

  const handleDragLeave = useCallback(
    (e: React.DragEvent) => {
      // Only clear state if we're actually leaving the container
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const { clientX, clientY } = e;
      const relatedTarget = e.relatedTarget as HTMLElement | null;
      const currentTarget = e.currentTarget as HTMLElement;

      // Check if we're leaving the container bounds
      const isOutside =
        clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom;

      // Check if the related target is still within our container
      const isStillInside = relatedTarget && currentTarget.contains(relatedTarget);

      if (isOutside && !isStillInside) {
        setDropIndex(null);
        setIsDragging(false);
        onDragLeave?.(e);
      }
    },
    [onDragLeave],
  );

  const handleDragEnd = useCallback(
    (e: React.DragEvent) => {
      setDropIndex(null);
      setIsDragging(false);
      onDragEnd?.(e);
    },
    [onDragEnd],
  );

  // Callback for child components to update drop index
  const updateDropIndex = useCallback((index: number | null) => {
    setDropIndex(index);
    if (index !== null) {
      setIsDragging(true);
    }
  }, []);

  // Memoize context value
  const contextValue: ItemListContextValue = useMemo(
    () => ({
      dropIndex,
      isDragging,
      baseClassName,
      updateDropIndex,
    }),
    [dropIndex, isDragging, baseClassName, updateDropIndex],
  );

  // Check if children is empty
  const childArray = React.Children.toArray(children);
  const isEmpty = childArray.length === 0;

  const computedClassName = [baseClassName, className].filter(Boolean).join(' ');

  return (
    <ItemListProvider value={contextValue}>
      <div
        ref={containerRef}
        className={computedClassName}
        style={style}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onDragLeave={handleDragLeave}
        onDragEnd={handleDragEnd}
      >
        {isEmpty && showEmptyState
          ? emptyState || (
              <div className={`${baseClassName}-empty`}>
                <p>No items</p>
              </div>
            )
          : children}
      </div>
    </ItemListProvider>
  );
};

ItemList.displayName = 'ItemList';
