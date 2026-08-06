export type ShortcutId =
  | 'global.save'
  | 'global.saveAs'
  | 'global.open'
  | 'global.new'
  | 'list.undo'
  | 'list.redo'
  | 'list.delete'
  | 'list.selectAll'
  | 'list.escape'
  | 'player.togglePlay';

export interface KeyBinding {
  code: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
}

export type ShortcutCategory = 'global' | 'list' | 'player';

export interface ShortcutDefinition {
  id: ShortcutId;
  defaultBinding: KeyBinding;
  alternateBinding?: KeyBinding;
  description: string;
  allowInInput?: boolean;
  category: ShortcutCategory;
}

export type CustomKeyBindings = Partial<Record<ShortcutId, KeyBinding>>;

export type ShortcutHandler = () => void;

export type ShortcutHandlers = Partial<Record<ShortcutId, ShortcutHandler>>;

export interface UseShortcutsOptions {
  enabled?: boolean;
}
