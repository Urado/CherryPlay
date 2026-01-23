/**
 * Keyboard Shortcuts Types
 *
 * Centralized type definitions for the keyboard shortcuts system.
 */

/**
 * Unique identifier for each shortcut action.
 * Format: category.action
 */
export type ShortcutId =
  // Global file operations
  | 'global.save'
  | 'global.saveAs'
  | 'global.open'
  | 'global.new'
  // List operations (undo/redo, selection, deletion)
  | 'list.undo'
  | 'list.redo'
  | 'list.delete'
  | 'list.selectAll'
  | 'list.escape';

/**
 * Represents a key combination for a shortcut.
 * Uses KeyboardEvent.code for layout-independent key identification.
 */
export interface KeyBinding {
  /** The key code (e.g., 'KeyS', 'KeyZ', 'Delete', 'Escape') */
  code: string;
  /** Whether Ctrl key must be pressed (Windows/Linux) */
  ctrlKey?: boolean;
  /** Whether Shift key must be pressed */
  shiftKey?: boolean;
  /** Whether Alt key must be pressed */
  altKey?: boolean;
  /** Whether Meta/Cmd key must be pressed (macOS) */
  metaKey?: boolean;
}

/**
 * Category of a shortcut for grouping and filtering.
 */
export type ShortcutCategory = 'global' | 'list';

/**
 * Complete definition of a keyboard shortcut.
 */
export interface ShortcutDefinition {
  /** Unique identifier */
  id: ShortcutId;
  /** Primary key binding */
  defaultBinding: KeyBinding;
  /** Alternative key binding (e.g., Ctrl+Y as alternative for Redo) */
  alternateBinding?: KeyBinding;
  /** Human-readable description */
  description: string;
  /** Whether this shortcut should work when focus is in an input field */
  allowInInput?: boolean;
  /** Category for grouping */
  category: ShortcutCategory;
}

/**
 * Type for user-customized key bindings stored in settings.
 * Only stores overrides; missing keys use defaults.
 */
export type CustomKeyBindings = Partial<Record<ShortcutId, KeyBinding>>;

/**
 * Handler function type for shortcut actions.
 */
export type ShortcutHandler = () => void;

/**
 * Map of shortcut handlers registered by components.
 */
export type ShortcutHandlers = Partial<Record<ShortcutId, ShortcutHandler>>;

/**
 * Options for the useShortcuts hook.
 */
export interface UseShortcutsOptions {
  /** Whether shortcuts are enabled (default: true) */
  enabled?: boolean;
}
