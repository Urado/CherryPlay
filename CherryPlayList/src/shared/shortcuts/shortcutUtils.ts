/**
 * Keyboard Shortcuts Utilities
 *
 * Helper functions for matching key events and formatting shortcuts for display.
 */

import type { KeyBinding } from './shortcutTypes';

/**
 * Check if a keyboard event matches a key binding.
 * Uses event.code for layout-independent matching.
 * Supports both Ctrl (Windows/Linux) and Meta/Cmd (macOS).
 *
 * @param event - The keyboard event to check
 * @param binding - The key binding to match against
 * @returns true if the event matches the binding
 */
export function matchKeyBinding(event: KeyboardEvent, binding: KeyBinding): boolean {
  // Check the key code
  if (event.code !== binding.code) {
    return false;
  }

  // Check Ctrl/Cmd modifier (support both Ctrl and Meta for cross-platform)
  const eventHasCtrlOrCmd = event.ctrlKey || event.metaKey;
  const bindingRequiresCtrl = binding.ctrlKey === true;

  if (bindingRequiresCtrl !== eventHasCtrlOrCmd) {
    return false;
  }

  // Check Shift modifier
  const bindingRequiresShift = binding.shiftKey === true;
  if (bindingRequiresShift !== event.shiftKey) {
    return false;
  }

  // Check Alt modifier
  const bindingRequiresAlt = binding.altKey === true;
  if (bindingRequiresAlt !== event.altKey) {
    return false;
  }

  return true;
}

/**
 * Check if the event target is an input field where shortcuts should be blocked.
 *
 * @param event - The keyboard event
 * @returns true if the target is an input field
 */
export function isInputField(event: KeyboardEvent): boolean {
  const target = event.target as HTMLElement;
  return (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.isContentEditable
  );
}

/**
 * Detect if the user is on macOS.
 *
 * @returns true if on macOS
 */
export function isMac(): boolean {
  return navigator.platform.toUpperCase().indexOf('MAC') >= 0;
}

/**
 * Format a key binding for display (e.g., "Ctrl+S" or "Cmd+S" on Mac).
 *
 * @param binding - The key binding to format
 * @returns Human-readable string representation
 */
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

  // Convert code to readable key name
  parts.push(codeToKeyName(binding.code));

  return parts.join('+');
}

/**
 * Convert a KeyboardEvent.code to a human-readable key name.
 *
 * @param code - The key code (e.g., 'KeyS', 'Delete')
 * @returns Human-readable key name (e.g., 'S', 'Delete')
 */
function codeToKeyName(code: string): string {
  // Handle letter keys (KeyA -> A)
  if (code.startsWith('Key')) {
    return code.slice(3);
  }

  // Handle digit keys (Digit1 -> 1)
  if (code.startsWith('Digit')) {
    return code.slice(5);
  }

  // Handle special keys
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

/**
 * Parse a shortcut string (e.g., "Ctrl+S") into a KeyBinding object.
 * Useful for user input or configuration files.
 *
 * @param shortcutString - The string to parse
 * @returns KeyBinding object or null if invalid
 */
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
        // This is the key
        binding.code = keyNameToCode(part);
        break;
    }
  }

  if (!binding.code) {
    return null;
  }

  return binding;
}

/**
 * Convert a key name to KeyboardEvent.code.
 *
 * @param keyName - The key name (e.g., 's', 'delete')
 * @returns The code (e.g., 'KeyS', 'Delete')
 */
function keyNameToCode(keyName: string): string {
  const normalized = keyName.toUpperCase();

  // Single letter
  if (normalized.length === 1 && normalized >= 'A' && normalized <= 'Z') {
    return `Key${normalized}`;
  }

  // Single digit
  if (normalized.length === 1 && normalized >= '0' && normalized <= '9') {
    return `Digit${normalized}`;
  }

  // Special keys
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
