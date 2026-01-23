import React, { createContext, useContext } from 'react';

/**
 * Context value for ListRow component
 * Provides state information to all child components
 */
export interface ListRowContextValue {
  /** Unique identifier for the row */
  id: string;
  /** Whether the row is currently selected */
  isSelected: boolean;
  /** Whether the row is being dragged */
  isDragging: boolean;
  /** Whether the row is active (e.g., currently playing track) */
  isActive: boolean;
  /** Whether the row is playing (for audio items) */
  isPlaying: boolean;
  /** Whether the row is disabled */
  isDisabled: boolean;
  /** Whether the row has been played (for session mode) */
  isPlayed: boolean;
  /** Whether this is the current item (e.g., current track in player) */
  isCurrent: boolean;
  /** Whether the row is locked (cannot be dragged/deleted) */
  isLocked: boolean;
  /** Nesting level for hierarchical items (groups) */
  level: number;
  /** Base CSS class name for styling */
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

/**
 * Hook to access ListRow context
 * Must be used within a ListRow component
 */
export function useListRowContext(): ListRowContextValue {
  const context = useContext(ListRowContext);
  if (!context) {
    throw new Error('useListRowContext must be used within a ListRow component');
  }
  return context;
}

/**
 * Props for ListRowContext.Provider wrapper
 */
export interface ListRowProviderProps {
  value: ListRowContextValue;
  children: React.ReactNode;
}

/**
 * Provider component for ListRow context
 */
export const ListRowProvider: React.FC<ListRowProviderProps> = ({ value, children }) => {
  return <ListRowContext.Provider value={value}>{children}</ListRowContext.Provider>;
};
