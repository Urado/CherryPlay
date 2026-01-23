import { useCallback } from 'react';

import { useItemListContext } from './ItemListContext';

export interface UseItemDragOverOptions {
  /** Index of the item in the list */
  index: number;
  /** Whether the item can be dropped on */
  disabled?: boolean;
}

/**
 * Hook for handling drag over on individual list items
 * Updates the drop index in ItemList context based on cursor position
 *
 * @example
 * ```tsx
 * const { handleDragOver } = useItemDragOver({ index: 3 });
 *
 * return (
 *   <div onDragOver={handleDragOver}>
 *     ...
 *   </div>
 * );
 * ```
 */
export function useItemDragOver({ index, disabled = false }: UseItemDragOverOptions) {
  const { updateDropIndex } = useItemListContext();

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      if (disabled) return;

      // Calculate insert position based on cursor position
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const y = e.clientY - rect.top;
      const isTopHalf = y < rect.height / 2;

      // If cursor is in top half, insert before this item (index)
      // If cursor is in bottom half, insert after this item (index + 1)
      const insertIndex = isTopHalf ? index : index + 1;

      updateDropIndex(insertIndex);
    },
    [index, disabled, updateDropIndex],
  );

  return { handleDragOver };
}
