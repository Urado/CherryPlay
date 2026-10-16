import React, { createContext, useContext } from 'react';

export interface ListRowContextValue {
  id: string;
  isSelected: boolean;
  isDragging: boolean;
  isActive: boolean;
  isPlaying: boolean;
  isDisabled: boolean;
  isPlayed: boolean;
  isCurrent: boolean;
  isLocked: boolean;
  level: number;
  baseClassName: string;
}

const defaultContextValue: ListRowContextValue = {
  id: '',
  isSelected: false,
  isDragging: false,
  isActive: false,
  isPlaying: false,
  isDisabled: false,
  isPlayed: false,
  isCurrent: false,
  isLocked: false,
  level: 0,
  baseClassName: 'list-row',
};

export const ListRowContext = createContext<ListRowContextValue>(defaultContextValue);

export const useListRowContext = (): ListRowContextValue => {
  const context = useContext(ListRowContext);
  if (!context) {
    throw new Error('useListRowContext must be used within a ListRow component');
  }
  return context;
};

export interface ListRowProviderProps {
  value: ListRowContextValue;
  children: React.ReactNode;
}

export const ListRowProvider: React.FC<ListRowProviderProps> = ({ value, children }) => {
  return <ListRowContext.Provider value={value}>{children}</ListRowContext.Provider>;
};
