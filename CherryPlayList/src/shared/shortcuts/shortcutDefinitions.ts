import type { ShortcutCategory, ShortcutDefinition, ShortcutId } from './shortcutTypes';

export const DEFAULT_SHORTCUTS: Record<ShortcutId, ShortcutDefinition> = {
  'global.save': {
    id: 'global.save',
    defaultBinding: { code: 'KeyS', ctrlKey: true },
    description: 'Сохранить проект (меню «Файл»)',
    allowInInput: true,
    category: 'global',
  },
  'global.saveAs': {
    id: 'global.saveAs',
    defaultBinding: { code: 'KeyS', ctrlKey: true, shiftKey: true },
    description: 'Сохранить как… (меню «Файл»)',
    allowInInput: true,
    category: 'global',
  },
  'global.open': {
    id: 'global.open',
    defaultBinding: { code: 'KeyO', ctrlKey: true },
    description: 'Открыть проект (меню «Файл»)',
    category: 'global',
  },
  'global.new': {
    id: 'global.new',
    defaultBinding: { code: 'KeyN', ctrlKey: true },
    description: 'Создать новый проект (меню «Файл»)',
    category: 'global',
  },

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
    allowInInput: true,
    category: 'list',
  },

  'player.togglePlay': {
    id: 'player.togglePlay',
    defaultBinding: { code: 'Space' },
    description: 'Пауза / воспроизведение (сессия)',
    allowInInput: false,
    category: 'player',
  },
};

export const ALL_SHORTCUT_IDS = Object.keys(DEFAULT_SHORTCUTS) as ShortcutId[];

export function getShortcutsByCategory(category: ShortcutCategory): ShortcutId[] {
  return ALL_SHORTCUT_IDS.filter((id) => DEFAULT_SHORTCUTS[id].category === category);
}
