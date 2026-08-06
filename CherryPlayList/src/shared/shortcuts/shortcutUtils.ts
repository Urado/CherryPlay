import type { KeyBinding } from './shortcutTypes';

const INTERACTIVE_SELECTOR = [
  'button',
  'a',
  'select',
  'summary',
  'option',
  '[role="button"]',
  '[role="menuitem"]',
  '[role="option"]',
  '[role="tab"]',
  '[role="switch"]',
  '[role="checkbox"]',
  '[role="radio"]',
  '[role="link"]',
  '[role="menuitemcheckbox"]',
  '[role="menuitemradio"]',
  '[role="treeitem"]',
  '[role="row"]',
  '[role="gridcell"]',
  '[role="combobox"]',
  '[role="slider"]',
  '[role="listbox"]',
].join(', ');

const PLAYER_SPACE_NATIVE_CONTROL_SELECTOR = [
  'button',
  'a',
  'select',
  'summary',
  '[role="menuitem"]',
  '[role="tab"]',
  '[role="switch"]',
  '[role="checkbox"]',
  '[role="radio"]',
  '[role="link"]',
  '[role="menuitemcheckbox"]',
  '[role="menuitemradio"]',
  '[role="combobox"]',
  '[role="slider"]',
].join(', ');

const PLAYER_SPACE_DIALOG_SELECTOR = '.modal-overlay, [role="dialog"], [aria-modal="true"]';

export function matchKeyBinding(event: KeyboardEvent, binding: KeyBinding): boolean {
  if (event.code !== binding.code) {
    return false;
  }

  const eventHasCtrlOrCmd = event.ctrlKey || event.metaKey;
  const bindingRequiresCtrl = binding.ctrlKey === true;

  if (bindingRequiresCtrl !== eventHasCtrlOrCmd) {
    return false;
  }

  const bindingRequiresShift = binding.shiftKey === true;
  if (bindingRequiresShift !== event.shiftKey) {
    return false;
  }

  const bindingRequiresAlt = binding.altKey === true;
  if (bindingRequiresAlt !== event.altKey) {
    return false;
  }

  return true;
}

export function isInputField(event: KeyboardEvent): boolean {
  const target = event.target as HTMLElement | null;
  if (!target) {
    return false;
  }
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
}

export function isInteractiveElement(event: KeyboardEvent): boolean {
  const target = event.target;
  if (!(target instanceof Element)) {
    return false;
  }
  return target.closest(INTERACTIVE_SELECTOR) !== null;
}

export function shouldBlockPlayerSpaceShortcut(event: KeyboardEvent): boolean {
  const target = event.target;
  if (!(target instanceof Element)) {
    return false;
  }
  if (isInputField(event)) {
    return true;
  }
  if (target.closest(PLAYER_SPACE_DIALOG_SELECTOR)) {
    return true;
  }
  if (target.closest(PLAYER_SPACE_NATIVE_CONTROL_SELECTOR)) {
    return true;
  }
  const roleButton = target.closest('[role="button"]');
  if (roleButton && !roleButton.hasAttribute('data-list-row')) {
    return true;
  }
  return false;
}

export function bindingHasModifier(binding: KeyBinding): boolean {
  return (
    binding.ctrlKey === true ||
    binding.metaKey === true ||
    binding.altKey === true ||
    binding.shiftKey === true
  );
}

export function isActivationKeyBinding(binding: KeyBinding): boolean {
  return (binding.code === 'Space' || binding.code === 'Enter') && !bindingHasModifier(binding);
}

export function isMac(): boolean {
  return navigator.platform.toUpperCase().indexOf('MAC') >= 0;
}

export function formatKeyBinding(binding: KeyBinding): string {
  const parts: string[] = [];

  if (binding.ctrlKey) {
    parts.push(isMac() ? 'Cmd' : 'Ctrl');
  }

  if (binding.altKey) {
    parts.push(isMac() ? 'Option' : 'Alt');
  }

  if (binding.shiftKey) {
    parts.push('Shift');
  }

  parts.push(codeToKeyName(binding.code));

  return parts.join('+');
}

function codeToKeyName(code: string): string {
  if (code.startsWith('Key')) {
    return code.slice(3);
  }

  if (code.startsWith('Digit')) {
    return code.slice(5);
  }

  const specialKeys: Record<string, string> = {
    Escape: 'Esc',
    Delete: 'Del',
    Backspace: 'Backspace',
    Enter: 'Enter',
    Space: 'Space',
    ArrowUp: '↑',
    ArrowDown: '↓',
    ArrowLeft: '←',
    ArrowRight: '→',
    Tab: 'Tab',
  };

  return specialKeys[code] || code;
}

export function parseShortcutString(shortcutString: string): KeyBinding | null {
  const parts = shortcutString.split('+').map((p) => p.trim().toLowerCase());

  if (parts.length === 0) {
    return null;
  }

  const binding: KeyBinding = {
    code: '',
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
  };

  for (const part of parts) {
    switch (part) {
      case 'ctrl':
      case 'cmd':
      case 'command':
        binding.ctrlKey = true;
        break;
      case 'shift':
        binding.shiftKey = true;
        break;
      case 'alt':
      case 'option':
        binding.altKey = true;
        break;
      default:
        binding.code = keyNameToCode(part);
        break;
    }
  }

  if (!binding.code) {
    return null;
  }

  return binding;
}

function keyNameToCode(keyName: string): string {
  const normalized = keyName.toUpperCase();

  if (normalized.length === 1 && normalized >= 'A' && normalized <= 'Z') {
    return `Key${normalized}`;
  }

  if (normalized.length === 1 && normalized >= '0' && normalized <= '9') {
    return `Digit${normalized}`;
  }

  const specialCodes: Record<string, string> = {
    ESC: 'Escape',
    ESCAPE: 'Escape',
    DEL: 'Delete',
    DELETE: 'Delete',
    BACKSPACE: 'Backspace',
    ENTER: 'Enter',
    RETURN: 'Enter',
    SPACE: 'Space',
    TAB: 'Tab',
  };

  return specialCodes[normalized] || normalized;
}
