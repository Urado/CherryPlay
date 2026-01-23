// ItemList - Container component with drop logic on container level
// Solves the "dead zone" bug where drops between items don't work

// Main component and context
export { ItemList } from './ItemList';
export type { ItemListProps } from './ItemList';
export { ItemListContext, ItemListProvider, useItemListContext } from './ItemListContext';
export type { ItemListContextValue, ItemListProviderProps } from './ItemListContext';

// Sub-components
export { DropIndicator, StandaloneDropIndicator } from './DropIndicator';
export type { DropIndicatorProps, StandaloneDropIndicatorProps } from './DropIndicator';
export { EmptyState } from './EmptyState';
export type { EmptyStateProps } from './EmptyState';

// Hooks
export { useItemDragOver } from './useItemDragOver';
export type { UseItemDragOverOptions } from './useItemDragOver';

// Compound component type with all sub-components attached
import { ItemList as ItemListBase } from './ItemList';
import { DropIndicator } from './DropIndicator';
import { EmptyState } from './EmptyState';

/**
 * ItemList compound component with all sub-components attached
 *
 * @example
 * ```tsx
 * <ItemListCompound onDragOver={handleDragOver} onDrop={handleDrop}>
 *   {items.map((item, index) => (
 *     <React.Fragment key={item.id}>
 *       <ItemListCompound.DropIndicator index={index} />
 *       <ListRow id={item.id}>...</ListRow>
 *     </React.Fragment>
 *   ))}
 *   <ItemListCompound.DropIndicator index={items.length} />
 * </ItemListCompound>
 * ```
 */
export const ItemListCompound = Object.assign(ItemListBase, {
  DropIndicator,
  EmptyState,
});
