/**
 * Keyboard Shortcuts Definitions
 *
 * Default key bindings for all application shortcuts.
 */

import type { ShortcutDefinition, ShortcutId } from './shortcutTypes';

/**
 * Default shortcut definitions.
 * These can be overridden by user settings.
 */
export const DEFAULT_SHORTCUTS: Record<ShortcutId, ShortcutDefinition> = {
  // Global file operations
  'global.save': {
    id: 'global.save',
    defaultBinding: { code: 'KeyS', ctrlKey: true },
    description: 'Сохранить проект',
    allowInInput: true, // Allow saving even when in input field
    category: 'global',
  },
  'global.saveAs': {
    id: 'global.saveAs',
    defaultBinding: { code: 'KeyS', ctrlKey: true, shiftKey: true },
    description: 'Сохранить проект как...',
    allowInInput: true,
    category: 'global',
  },
  'global.open': {
    id: 'global.open',
    defaultBinding: { code: 'KeyO', ctrlKey: true },
    description: 'Открыть проект',
    category: 'global',
  },
  'global.new': {
    id: 'global.new',
    defaultBinding: { code: 'KeyN', ctrlKey: true },
    description: 'Создать новый проект',
    category: 'global',
  },

  // List operations
  'list.undo': {
    id: 'list.undo',
    defaultBinding: { code: 'KeyZ', ctrlKey: true },
    description: 'Отменить последнее действие',
    category: 'list',
  },
  'list.redo': {
    id: 'list.redo',
    defaultBinding: { code: 'KeyY', ctrlKey: true },
    alternateBinding: { code: 'KeyZ', ctrlKey: true, shiftKey: true },
    description: 'Повторить отменённое действие',
    category: 'list',
  },
  'list.delete': {
    id: 'list.delete',
    defaultBinding: { code: 'Delete' },
    description: 'Удалить выделенные элементы',
    category: 'list',
  },
  'list.selectAll': {
    id: 'list.selectAll',
    defaultBinding: { code: 'KeyA', ctrlKey: true },
    description: 'Выделить все элементы',
    category: 'list',
  },
  'list.escape': {
    id: 'list.escape',
    defaultBinding: { code: 'Escape' },
    description: 'Снять выделение / Отмена',
    allowInInput: true, // Allow Escape to blur input fields
    category: 'list',
  },
};

/**
 * Get all shortcut IDs.
 */
export const ALL_SHORTCUT_IDS = Object.keys(DEFAULT_SHORTCUTS) as ShortcutId[];

/**
 * Get shortcut IDs by category.
 */
export function getShortcutsByCategory(category: 'global' | 'list'): ShortcutId[] {
  return ALL_SHORTCUT_IDS.filter((id) => DEFAULT_SHORTCUTS[id].category === category);
}
