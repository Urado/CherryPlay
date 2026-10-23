import { useCallback, useRef } from 'react';

export interface UseItemSelectionOptions<T extends { id: string }> {
  items: T[];
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
}

export interface UseItemSelectionReturn {
  handleClick: (id: string, event?: React.MouseEvent) => void;
  selectAll: () => void;
  deselectAll: () => void;
  selectRange: (fromId: string, toId: string) => void;
  toggleSelection: (id: string) => void;
  isSelected: (id: string) => boolean;
}

export const useItemSelection = <T extends { id: string }>({
  items,
  selectedIds,
  onSelectionChange,
}: UseItemSelectionOptions<T>): UseItemSelectionReturn => {
  const lastSelectedRef = useRef<string | null>(null);

  const toggleSelection = useCallback(
    (id: string) => {
      const newSelection = new Set(selectedIds);
      if (newSelection.has(id)) {
        newSelection.delete(id);
      } else {
        newSelection.add(id);
      }
      lastSelectedRef.current = id;
      onSelectionChange(newSelection);
    },
    [selectedIds, onSelectionChange],
  );

  const selectRange = useCallback(
    (fromId: string, toId: string) => {
      const fromIndex = items.findIndex((item) => item.id === fromId);
      const toIndex = items.findIndex((item) => item.id === toId);

      if (fromIndex === -1 || toIndex === -1) {
        toggleSelection(toId);
        return;
      }

      const startIndex = Math.min(fromIndex, toIndex);
      const endIndex = Math.max(fromIndex, toIndex);

      const newSelection = new Set(selectedIds);
      for (let i = startIndex; i <= endIndex; i++) {
        newSelection.add(items[i].id);
      }

      lastSelectedRef.current = toId;
      onSelectionChange(newSelection);
    },
    [items, selectedIds, onSelectionChange, toggleSelection],
  );

  const handleClick = useCallback(
    (id: string, event?: React.MouseEvent) => {
      const isCtrlOrCmd = event?.ctrlKey || event?.metaKey;
      const isShift = event?.shiftKey;

      if (isCtrlOrCmd) {
        toggleSelection(id);
      } else if (isShift && lastSelectedRef.current && selectedIds.size > 0) {
        selectRange(lastSelectedRef.current, id);
      } else {
        toggleSelection(id);
      }
    },
    [selectedIds, selectRange, toggleSelection],
  );

  const selectAll = useCallback(() => {
    const allIds = new Set(items.map((item) => item.id));
    if (items.length > 0) {
      lastSelectedRef.current = items[items.length - 1].id;
    }
    onSelectionChange(allIds);
  }, [items, onSelectionChange]);

  const deselectAll = useCallback(() => {
    lastSelectedRef.current = null;
    onSelectionChange(new Set());
  }, [onSelectionChange]);

  const isSelected = useCallback(
    (id: string) => {
      return selectedIds.has(id);
    },
    [selectedIds],
  );

  return {
    handleClick,
    selectAll,
    deselectAll,
    selectRange,
    toggleSelection,
    isSelected,
  };
};
