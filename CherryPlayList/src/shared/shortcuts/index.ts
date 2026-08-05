export type {
  CustomKeyBindings,
  KeyBinding,
  ShortcutCategory,
  ShortcutDefinition,
  ShortcutHandler,
  ShortcutHandlers,
  ShortcutId,
  UseShortcutsOptions,
} from './shortcutTypes';

export { ALL_SHORTCUT_IDS, DEFAULT_SHORTCUTS, getShortcutsByCategory } from './shortcutDefinitions';

export {
  bindingHasModifier,
  formatKeyBinding,
  isActivationKeyBinding,
  isInputField,
  isInteractiveElement,
  shouldBlockPlayerSpaceShortcut,
  isMac,
  matchKeyBinding,
  parseShortcutString,
} from './shortcutUtils';

export { shortcutManager } from './ShortcutManager';

export {
  useGlobalShortcuts,
  useListShortcuts,
  usePlayerShortcuts,
  useShortcuts,
} from './useShortcuts';

import { shortcutManager } from './ShortcutManager';
import type { CustomKeyBindings } from './shortcutTypes';

export interface InitializeShortcutsOptions {
  isShortcutsBlocked?: () => boolean;
}

export function initializeShortcuts(
  getCustomBindings: () => CustomKeyBindings,
  options: InitializeShortcutsOptions = {},
): void {
  shortcutManager.init(getCustomBindings, options.isShortcutsBlocked);
}

export function destroyShortcuts(): void {
  shortcutManager.destroy();
}
