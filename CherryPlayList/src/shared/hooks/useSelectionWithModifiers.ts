import { useCallback, useRef } from 'react';

export interface UseSelectionWithModifiersOptions {
  toggleSelection: (id: string) => void;
  selectRange: (fromId: string, toId: string) => void;
}

export interface UseSelectionWithModifiersReturn {
  handleToggleSelect: (id: string, event?: React.MouseEvent) => void;
  lastSelectedIdRef: React.MutableRefObject<string | null>;
}

export const useSelectionWithModifiers = ({
  toggleSelection,
  selectRange,
}: UseSelectionWithModifiersOptions): UseSelectionWithModifiersReturn => {
  const lastSelectedIdRef = useRef<string | null>(null);

  const handleToggleSelect = useCallback(
    (id: string, event?: React.MouseEvent) => {
      if (event?.shiftKey && lastSelectedIdRef.current) {
        selectRange(lastSelectedIdRef.current, id);
      } else {
        toggleSelection(id);
        lastSelectedIdRef.current = id;
      }
    },
    [toggleSelection, selectRange],
  );

  return {
    handleToggleSelect,
    lastSelectedIdRef,
  };
};
