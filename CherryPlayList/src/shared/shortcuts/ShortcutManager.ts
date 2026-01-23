/**
 * Keyboard Shortcuts Manager
 *
 * Singleton that manages a single global keydown listener and dispatches
 * keyboard events to registered handlers based on configured key bindings.
 */

import { DEFAULT_SHORTCUTS } from './shortcutDefinitions';
import type { CustomKeyBindings, KeyBinding, ShortcutHandler, ShortcutId } from './shortcutTypes';
import { isInputField, matchKeyBinding } from './shortcutUtils';

/**
 * Function type for getting custom key bindings from settings store.
 */
type GetCustomBindings = () => CustomKeyBindings;

/**
 * ShortcutManager - Centralized keyboard shortcut handling.
 *
 * Features:
 * - Single global keydown listener
 * - Support for custom key bindings
 * - Handler registration/unregistration
 * - Input field detection and bypass
 * - Cross-platform Ctrl/Cmd support
 */
class ShortcutManager {
  /** Registered handlers for each shortcut */
  private handlers = new Map<ShortcutId, ShortcutHandler>();

  /** Function to get custom bindings from settings */
  private getCustomBindings: GetCustomBindings = () => ({});

  /** Whether the manager is initialized */
  private isInitialized = false;

  /** Bound handleKeyDown for proper removal */
  private boundHandleKeyDown: (e: KeyboardEvent) => void;

  constructor() {
    this.boundHandleKeyDown = this.handleKeyDown.bind(this);
  }

  /**
   * Initialize the shortcut manager.
   * Should be called once at app startup.
   *
   * @param getCustomBindings - Function to retrieve custom bindings from settings
   */
  init(getCustomBindings: GetCustomBindings): void {
    if (this.isInitialized) {
      console.warn('ShortcutManager is already initialized');
      return;
    }

    this.getCustomBindings = getCustomBindings;
    window.addEventListener('keydown', this.boundHandleKeyDown);
    this.isInitialized = true;
  }

  /**
   * Destroy the shortcut manager.
   * Removes the event listener and clears all handlers.
   */
  destroy(): void {
    if (!this.isInitialized) {
      return;
    }

    window.removeEventListener('keydown', this.boundHandleKeyDown);
    this.handlers.clear();
    this.isInitialized = false;
  }

  /**
   * Register a handler for a shortcut.
   * If a handler already exists, it will be replaced.
   *
   * @param id - The shortcut ID
   * @param handler - The handler function
   */
  registerHandler(id: ShortcutId, handler: ShortcutHandler): void {
    this.handlers.set(id, handler);
  }

  /**
   * Unregister a handler for a shortcut.
   *
   * @param id - The shortcut ID
   */
  unregisterHandler(id: ShortcutId): void {
    this.handlers.delete(id);
  }

  /**
   * Check if a handler is registered for a shortcut.
   *
   * @param id - The shortcut ID
   * @returns true if a handler is registered
   */
  hasHandler(id: ShortcutId): boolean {
    return this.handlers.has(id);
  }

  /**
   * Get the effective key binding for a shortcut.
   * Returns custom binding if set, otherwise the default.
   *
   * @param id - The shortcut ID
   * @returns The key binding
   */
  getBinding(id: ShortcutId): KeyBinding {
    const customBindings = this.getCustomBindings();
    return customBindings[id] || DEFAULT_SHORTCUTS[id].defaultBinding;
  }

  /**
   * Get the alternate key binding for a shortcut (if any).
   *
   * @param id - The shortcut ID
   * @returns The alternate binding or undefined
   */
  getAlternateBinding(id: ShortcutId): KeyBinding | undefined {
    return DEFAULT_SHORTCUTS[id].alternateBinding;
  }

  /**
   * Handle keydown events.
   * Matches the event against all registered shortcuts and executes the handler.
   */
  private handleKeyDown(event: KeyboardEvent): void {
    const inInputField = isInputField(event);

    // Try to find a matching shortcut
    for (const [id, handler] of this.handlers) {
      const definition = DEFAULT_SHORTCUTS[id];

      // Skip shortcuts that don't work in input fields
      if (inInputField && !definition.allowInInput) {
        continue;
      }

      // Get the effective binding
      const binding = this.getBinding(id);
      const alternateBinding = this.getAlternateBinding(id);

      // Check if event matches binding
      const matchesPrimary = matchKeyBinding(event, binding);
      const matchesAlternate = alternateBinding
        ? matchKeyBinding(event, alternateBinding)
        : false;

      if (matchesPrimary || matchesAlternate) {
        event.preventDefault();
        handler();
        return; // Only execute one handler per event
      }
    }
  }
}

/**
 * Singleton instance of ShortcutManager.
 */
export const shortcutManager = new ShortcutManager();
