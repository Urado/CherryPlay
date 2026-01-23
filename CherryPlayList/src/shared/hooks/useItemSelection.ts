import { useCallback, useRef } from 'react';

/**
 * Options for useItemSelection hook
 */
export interface UseItemSelectionOptions<T extends { id: string }> {
  /** Array of items that can be selected */
  items: T[];
  /** Currently selected item IDs */
  selectedIds: Set<string>;
  /** Callback when selection changes */
  onSelectionChange: (ids: Set<string>) => void;
}

/**
 * Return type for useItemSelection hook
 */
export interface UseItemSelectionReturn {
  /** Handle click on an item with modifier key support */
  handleClick: (id: string, event?: React.MouseEvent) => void;
  /** Select all items */
  selectAll: () => void;
  /** Deselect all items */
  deselectAll: () => void;
  /** Select a range of items between two IDs */
  selectRange: (fromId: string, toId: string) => void;
  /** Toggle selection of a single item */
  toggleSelection: (id: string) => void;
  /** Check if an item is selected */
  isSelected: (id: string) => boolean;
}

/**
 * useItemSelection - Unified selection logic for list items
 *
 * Provides consistent selection behavior across all list views:
 * - Single click: Toggle selection (or replace selection without modifiers)
 * - Ctrl/Cmd + click: Add/remove from selection
 * - Shift + click: Select range from last selected item
 *
 * @example
 * ```tsx
 * const { handleClick, selectAll, deselectAll } = useItemSelection({
 *   items: tracks,
 *   selectedIds: selectedTrackIds,
 *   onSelectionChange: setSelectedTrackIds,
 * });
 *
 * // In component
 * <ListRow onClick={(e) => handleClick(track.id, e)} />
 * ```
 */
export function useItemSelection<T extends { id: string }>({
  items,
  selectedIds,
  onSelectionChange,
}: UseItemSelectionOptions<T>): UseItemSelectionReturn {
  // Track the last selected item for range selection
  const lastSelectedRef = useRef<string | null>(null);

  /**
   * Toggle selection of a single item
   */
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

  /**
   * Select a range of items between two IDs
   */
  const selectRange = useCallback(
    (fromId: string, toId: string) => {
      const fromIndex = items.findIndex((item) => item.id === fromId);
      const toIndex = items.findIndex((item) => item.id === toId);

      if (fromIndex === -1 || toIndex === -1) {
        // If either item not found, just toggle the target
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

  /**
   * Handle click with modifier key support
   */
  const handleClick = useCallback(
    (id: string, event?: React.MouseEvent) => {
      const isCtrlOrCmd = event?.ctrlKey || event?.metaKey;
      const isShift = event?.shiftKey;

      if (isCtrlOrCmd) {
        // Ctrl/Cmd + click: Add/remove from selection
        toggleSelection(id);
      } else if (isShift && lastSelectedRef.current && selectedIds.size > 0) {
        // Shift + click: Select range from last selected
        selectRange(lastSelectedRef.current, id);
      } else {
        // Regular click: Toggle selection
        toggleSelection(id);
      }
    },
    [selectedIds, selectRange, toggleSelection],
  );

  /**
   * Select all items
   */
  const selectAll = useCallback(() => {
    const allIds = new Set(items.map((item) => item.id));
    if (items.length > 0) {
      lastSelectedRef.current = items[items.length - 1].id;
    }
    onSelectionChange(allIds);
  }, [items, onSelectionChange]);

  /**
   * Deselect all items
   */
  const deselectAll = useCallback(() => {
    lastSelectedRef.current = null;
    onSelectionChange(new Set());
  }, [onSelectionChange]);

  /**
   * Check if an item is selected
   */
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
}
