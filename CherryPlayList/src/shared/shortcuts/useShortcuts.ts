/**
 * useShortcuts Hook
 *
 * React hook for registering keyboard shortcut handlers.
 */

import { useEffect, useRef } from 'react';

import { shortcutManager } from './ShortcutManager';
import type { ShortcutHandlers, ShortcutId, UseShortcutsOptions } from './shortcutTypes';

/**
 * useShortcuts - Register handlers for keyboard shortcuts.
 *
 * Handlers are registered when the component mounts (or when enabled becomes true)
 * and unregistered when the component unmounts (or when enabled becomes false).
 *
 * @param handlers - Object mapping shortcut IDs to handler functions
 * @param options - Configuration options
 *
 * @example
 * ```tsx
 * useShortcuts({
 *   'global.save': handleSave,
 *   'global.open': handleOpen,
 *   'list.undo': undo,
 *   'list.redo': redo,
 *   'list.delete': hasSelection ? removeSelected : undefined,
 * }, { enabled: true });
 * ```
 */
export function useShortcuts(
  handlers: ShortcutHandlers,
  options: UseShortcutsOptions = {},
): void {
  const { enabled = true } = options;

  // Keep track of which handlers we've registered
  const registeredIds = useRef<Set<ShortcutId>>(new Set());

  useEffect(() => {
    if (!enabled) {
      // Unregister all handlers when disabled
      for (const id of registeredIds.current) {
        shortcutManager.unregisterHandler(id);
      }
      registeredIds.current.clear();
      return;
    }

    // Get the list of handler entries
    const handlerEntries = Object.entries(handlers) as [ShortcutId, (() => void) | undefined][];

    // Track which IDs we should have registered
    const currentIds = new Set<ShortcutId>();

    // Register handlers
    for (const [id, handler] of handlerEntries) {
      if (handler) {
        shortcutManager.registerHandler(id, handler);
        currentIds.add(id);
      }
    }

    // Unregister handlers that were removed
    for (const id of registeredIds.current) {
      if (!currentIds.has(id)) {
        shortcutManager.unregisterHandler(id);
      }
    }

    // Update our tracking set
    registeredIds.current = currentIds;

    // Cleanup on unmount
    return () => {
      for (const id of registeredIds.current) {
        shortcutManager.unregisterHandler(id);
      }
      registeredIds.current.clear();
    };
  }, [handlers, enabled]);
}

/**
 * useGlobalShortcuts - Convenience hook for global shortcuts.
 *
 * This is a specialized version of useShortcuts that always keeps
 * handlers registered (enabled by default, no conditional logic).
 *
 * @param handlers - Object mapping shortcut IDs to handler functions
 *
 * @example
 * ```tsx
 * useGlobalShortcuts({
 *   'global.save': handleSave,
 *   'global.saveAs': handleSaveAs,
 *   'global.open': handleOpen,
 *   'global.new': handleNew,
 * });
 * ```
 */
export function useGlobalShortcuts(
  handlers: Pick<ShortcutHandlers, 'global.save' | 'global.saveAs' | 'global.open' | 'global.new'>,
): void {
  useShortcuts(handlers, { enabled: true });
}

/**
 * useListShortcuts - Convenience hook for list operation shortcuts.
 *
 * @param handlers - Object mapping list shortcut IDs to handler functions
 * @param options - Configuration options
 *
 * @example
 * ```tsx
 * useListShortcuts({
 *   'list.undo': undo,
 *   'list.redo': redo,
 *   'list.delete': hasSelection ? removeSelected : undefined,
 *   'list.selectAll': selectAll,
 *   'list.escape': deselectAll,
 * }, { enabled: isListFocused });
 * ```
 */
export function useListShortcuts(
  handlers: Pick<
    ShortcutHandlers,
    'list.undo' | 'list.redo' | 'list.delete' | 'list.selectAll' | 'list.escape'
  >,
  options: UseShortcutsOptions = {},
): void {
  useShortcuts(handlers, options);
}
