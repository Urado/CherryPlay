import { useCallback, useRef } from 'react';

/**
 * Options for useSelectionWithModifiers hook
 */
export interface UseSelectionWithModifiersOptions {
  /** Toggle selection of a single item */
  toggleSelection: (id: string) => void;
  /** Select a range of items between two IDs */
  selectRange: (fromId: string, toId: string) => void;
}

/**
 * Return type for useSelectionWithModifiers hook
 */
export interface UseSelectionWithModifiersReturn {
  /** Handle click/select with modifier key support (Ctrl, Shift) */
  handleToggleSelect: (id: string, event?: React.MouseEvent) => void;
  /** Reference to the last selected item ID (for range selection) */
  lastSelectedIdRef: React.MutableRefObject<string | null>;
}

/**
 * useSelectionWithModifiers - Unified selection handler with modifier key support
 *
 * Provides consistent selection behavior with modifier keys across all list views:
 * - Regular click: Toggle selection
 * - Ctrl/Cmd + click: Toggle selection (same as regular)
 * - Shift + click: Select range from last selected item
 *
 * This hook complements useItemSelection by providing a ready-to-use handler
 * that tracks the last selected item for range selection.
 *
 * @example
 * ```tsx
 * const { handleToggleSelect } = useSelectionWithModifiers({
 *   toggleSelection: toggleItemSelection,
 *   selectRange: selectRange,
 * });
 *
 * // In component
 * <ProjectItemRow
 *   onToggleSelect={handleToggleSelect}
 *   ...
 * />
 * ```
 */
export function useSelectionWithModifiers({
  toggleSelection,
  selectRange,
}: UseSelectionWithModifiersOptions): UseSelectionWithModifiersReturn {
  // Track the last selected item for Shift+click range selection
  const lastSelectedIdRef = useRef<string | null>(null);

  /**
   * Handle selection with modifier key support
   */
  const handleToggleSelect = useCallback(
    (id: string, event?: React.MouseEvent) => {
      if (event?.ctrlKey || event?.metaKey) {
        // Ctrl/Cmd + click: Toggle selection
        toggleSelection(id);
      } else if (event?.shiftKey && lastSelectedIdRef.current) {
        // Shift + click: Select range from last selected
        selectRange(lastSelectedIdRef.current, id);
      } else {
        // Regular click: Toggle selection
        toggleSelection(id);
      }
      // Always update last selected
      lastSelectedIdRef.current = id;
    },
    [toggleSelection, selectRange],
  );

  return {
    handleToggleSelect,
    lastSelectedIdRef,
  };
}
