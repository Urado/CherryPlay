import { DEFAULT_SHORTCUTS } from './shortcutDefinitions';
import type { CustomKeyBindings, KeyBinding, ShortcutHandler, ShortcutId } from './shortcutTypes';
import {
  isActivationKeyBinding,
  isInputField,
  isInteractiveElement,
  matchKeyBinding,
  shouldBlockPlayerSpaceShortcut,
} from './shortcutUtils';

type GetCustomBindings = () => CustomKeyBindings;

type IsShortcutsBlocked = () => boolean;

class ShortcutManager {
  private handlers = new Map<ShortcutId, ShortcutHandler>();

  private getCustomBindings: GetCustomBindings = () => ({});

  private isShortcutsBlocked: IsShortcutsBlocked = () => false;

  private isInitialized = false;

  private boundHandleKeyDown: (e: KeyboardEvent) => void;

  constructor() {
    this.boundHandleKeyDown = this.handleKeyDown.bind(this);
  }

  init(getCustomBindings: GetCustomBindings, isShortcutsBlocked?: IsShortcutsBlocked): void {
    if (this.isInitialized) {
      console.warn('ShortcutManager is already initialized');
      return;
    }

    this.getCustomBindings = getCustomBindings;
    if (isShortcutsBlocked) {
      this.isShortcutsBlocked = isShortcutsBlocked;
    }
    window.addEventListener('keydown', this.boundHandleKeyDown);
    this.isInitialized = true;
  }

  destroy(): void {
    if (!this.isInitialized) {
      return;
    }

    window.removeEventListener('keydown', this.boundHandleKeyDown);
    this.handlers.clear();
    this.isShortcutsBlocked = () => false;
    this.isInitialized = false;
  }

  registerHandler(id: ShortcutId, handler: ShortcutHandler): void {
    this.handlers.set(id, handler);
  }

  unregisterHandler(id: ShortcutId): void {
    this.handlers.delete(id);
  }

  hasHandler(id: ShortcutId): boolean {
    return this.handlers.has(id);
  }

  getBinding(id: ShortcutId): KeyBinding {
    const customBindings = this.getCustomBindings();
    return customBindings[id] || DEFAULT_SHORTCUTS[id].defaultBinding;
  }

  getAlternateBinding(id: ShortcutId): KeyBinding | undefined {
    return DEFAULT_SHORTCUTS[id].alternateBinding;
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (this.isShortcutsBlocked()) {
      return;
    }

    const inInputField = isInputField(event);
    const onInteractive = isInteractiveElement(event);

    for (const [id, handler] of this.handlers) {
      const definition = DEFAULT_SHORTCUTS[id];

      if (inInputField && !definition.allowInInput) {
        continue;
      }

      const binding = this.getBinding(id);
      const alternateBinding = this.getAlternateBinding(id);

      const matchesPrimary = matchKeyBinding(event, binding);
      const matchesAlternate = alternateBinding ? matchKeyBinding(event, alternateBinding) : false;

      if (!matchesPrimary && !matchesAlternate) {
        continue;
      }

      const matchedBinding = matchesPrimary ? binding : alternateBinding!;
      if (onInteractive && isActivationKeyBinding(matchedBinding)) {
        if (id === 'player.togglePlay') {
          if (shouldBlockPlayerSpaceShortcut(event)) {
            continue;
          }
        } else {
          continue;
        }
      }

      event.preventDefault();
      handler();
      return;
    }
  }
}

export const shortcutManager = new ShortcutManager();
