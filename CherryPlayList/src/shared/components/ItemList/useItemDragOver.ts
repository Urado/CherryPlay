import { useCallback } from 'react';

import { useItemListContext } from './ItemListContext';

export interface UseItemDragOverOptions {
  index: number;
  disabled?: boolean;
}

export const useItemDragOver = ({ index, disabled = false }: UseItemDragOverOptions) => {
  const { updateDropIndex } = useItemListContext();

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      if (disabled) return;

      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const y = e.clientY - rect.top;
      const isTopHalf = y < rect.height / 2;

      const insertIndex = isTopHalf ? index : index + 1;

      updateDropIndex(insertIndex);
    },
    [index, disabled, updateDropIndex],
  );

  return { handleDragOver };
};
