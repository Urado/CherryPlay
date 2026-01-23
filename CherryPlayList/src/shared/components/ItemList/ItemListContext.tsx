import React, { createContext, useContext } from 'react';

/**
 * Context value for ItemList component
 * Provides drop state information to all child components
 */
export interface ItemListContextValue {
  /** Current drop index (where the item will be inserted) */
  dropIndex: number | null;
  /** Whether a drag operation is in progress */
  isDragging: boolean;
  /** Base CSS class name for styling */
  baseClassName: string;
  /** Update drop index from child components (e.g., when dragging over items) */
  updateDropIndex: (index: number | null) => void;
}

const defaultContextValue: ItemListContextValue = {
  dropIndex: null,
  isDragging: false,
  baseClassName: 'item-list',
  updateDropIndex: () => {},
};

export const ItemListContext = createContext<ItemListContextValue>(defaultContextValue);

/**
 * Hook to access ItemList context
 * Must be used within an ItemList component
 */
export function useItemListContext(): ItemListContextValue {
  const context = useContext(ItemListContext);
  if (!context) {
    throw new Error('useItemListContext must be used within an ItemList component');
  }
  return context;
}

/**
 * Props for ItemListContext.Provider wrapper
 */
export interface ItemListProviderProps {
  value: ItemListContextValue;
  children: React.ReactNode;
}

/**
 * Provider component for ItemList context
 */
export const ItemListProvider: React.FC<ItemListProviderProps> = ({ value, children }) => {
  return <ItemListContext.Provider value={value}>{children}</ItemListContext.Provider>;
};
