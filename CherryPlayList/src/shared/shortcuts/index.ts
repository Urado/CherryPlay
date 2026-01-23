/**
 * Keyboard Shortcuts Module
 *
 * Centralized keyboard shortcut handling with support for customization.
 *
 * Usage:
 * 1. Initialize the manager in App.tsx:
 *    ```tsx
 *    import { initializeShortcuts } from '@shared/shortcuts';
 *    initializeShortcuts(() => useSettingsStore.getState().keyBindings);
 *    ```
 *
 * 2. Register handlers in components:
 *    ```tsx
 *    import { useShortcuts } from '@shared/shortcuts';
 *    useShortcuts({
 *      'global.save': handleSave,
 *      'list.undo': undo,
 *    });
 *    ```
 */

// Types
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

// Definitions
export { ALL_SHORTCUT_IDS, DEFAULT_SHORTCUTS, getShortcutsByCategory } from './shortcutDefinitions';

// Utilities
export {
  formatKeyBinding,
  isInputField,
  isMac,
  matchKeyBinding,
  parseShortcutString,
} from './shortcutUtils';

// Manager
export { shortcutManager } from './ShortcutManager';

// Hooks
export { useGlobalShortcuts, useListShortcuts, useShortcuts } from './useShortcuts';

// Re-export CustomKeyBindings type for settingsStore
import type { CustomKeyBindings } from './shortcutTypes';

import { shortcutManager } from './ShortcutManager';

/**
 * Initialize the shortcut system.
 * Should be called once at app startup.
 *
 * @param getCustomBindings - Function to get custom key bindings from settings
 */
export function initializeShortcuts(getCustomBindings: () => CustomKeyBindings): void {
  shortcutManager.init(getCustomBindings);
}

/**
 * Destroy the shortcut system.
 * Should be called on app shutdown (useful for testing).
 */
export function destroyShortcuts(): void {
  shortcutManager.destroy();
}
