import React, { createContext, useContext } from 'react';

export interface ItemListContextValue {
  dropIndex: number | null;
  isDragging: boolean;
  baseClassName: string;
  updateDropIndex: (index: number | null) => void;
}

const defaultContextValue: ItemListContextValue = {
  dropIndex: null,
  isDragging: false,
  baseClassName: 'item-list',
  updateDropIndex: () => {},
};

export const ItemListContext = createContext<ItemListContextValue>(defaultContextValue);

export const useItemListContext = (): ItemListContextValue => {
  const context = useContext(ItemListContext);
  if (!context) {
    throw new Error('useItemListContext must be used within an ItemList component');
  }
  return context;
};

export interface ItemListProviderProps {
  value: ItemListContextValue;
  children: React.ReactNode;
}

export const ItemListProvider: React.FC<ItemListProviderProps> = ({ value, children }) => {
  return <ItemListContext.Provider value={value}>{children}</ItemListContext.Provider>;
};
