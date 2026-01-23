// ListRow - Compound Components for list items
// Provides flexible composition of list row elements

// Main component and context
export { ListRow } from './ListRow';
export type { ListRowProps } from './ListRow';
export { ListRowContext, ListRowProvider, useListRowContext } from './ListRowContext';
export type { ListRowContextValue, ListRowProviderProps } from './ListRowContext';

// Actions container
export { Actions } from './Actions';
export type { ActionsProps } from './Actions';

// Action components
export { ActionButton } from './actions/ActionButton';
export type { ActionButtonProps } from './actions/ActionButton';
export { PlayButton } from './actions/PlayButton';
export type { PlayButtonProps } from './actions/PlayButton';
export { DeleteButton } from './actions/DeleteButton';
export type { DeleteButtonProps } from './actions/DeleteButton';
export { DisableButton } from './actions/DisableButton';
export type { DisableButtonProps } from './actions/DisableButton';
export { DragHandle } from './actions/DragHandle';
export { Checkbox } from './actions/Checkbox';
export type { CheckboxProps } from './actions/Checkbox';
export { SettingsButton } from './actions/SettingsButton';
export type { SettingsButtonProps } from './actions/SettingsButton';
export { UngroupButton } from './actions/UngroupButton';
export type { UngroupButtonProps } from './actions/UngroupButton';

// Content components
export { Index } from './content/Index';
export type { IndexProps } from './content/Index';
export { Content } from './content/Content';
export type { ContentProps } from './content/Content';
export { Secondary } from './content/Secondary';
export type { SecondaryProps } from './content/Secondary';

// Compound component type with all sub-components attached
import { ListRow as ListRowBase } from './ListRow';
import { Actions } from './Actions';
import { ActionButton } from './actions/ActionButton';
import { PlayButton } from './actions/PlayButton';
import { DeleteButton } from './actions/DeleteButton';
import { DisableButton } from './actions/DisableButton';
import { DragHandle } from './actions/DragHandle';
import { Checkbox } from './actions/Checkbox';
import { SettingsButton } from './actions/SettingsButton';
import { UngroupButton } from './actions/UngroupButton';
import { Index } from './content/Index';
import { Content } from './content/Content';
import { Secondary } from './content/Secondary';

/**
 * ListRow compound component with all sub-components attached
 *
 * @example
 * ```tsx
 * <ListRowCompound id="track-1" isSelected={true}>
 *   <ListRowCompound.DragHandle />
 *   <ListRowCompound.Checkbox onToggle={handleToggle} />
 *   <ListRowCompound.Index value={0} />
 *   <ListRowCompound.Content>{track.name}</ListRowCompound.Content>
 *   <ListRowCompound.Secondary>{duration}</ListRowCompound.Secondary>
 *   <ListRowCompound.Actions>
 *     <ListRowCompound.PlayButton onPlay={handlePlay} />
 *     <ListRowCompound.DeleteButton onClick={handleDelete} />
 *   </ListRowCompound.Actions>
 * </ListRowCompound>
 * ```
 */
export const ListRowCompound = Object.assign(ListRowBase, {
  Actions,
  ActionButton,
  PlayButton,
  DeleteButton,
  DisableButton,
  DragHandle,
  Checkbox,
  SettingsButton,
  UngroupButton,
  Index,
  Content,
  Secondary,
});
