/**
 * Shared keyboard contract for CherryPlayList modals:
 * - Enter → primary action (when provided)
 * - Escape → cancel / close
 * - Enter in textarea / contenteditable → newline (not submit)
 * - Enter on overlay / focused button → no duplicate submit
 */

export function shouldIgnoreEnterForPrimary(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return true;
  }

  if (target.tagName === 'TEXTAREA' || target.isContentEditable) {
    return true;
  }

  if (target.tagName === 'BUTTON') {
    return true;
  }

  if (target.tagName === 'SELECT') {
    return true;
  }

  if (target instanceof HTMLInputElement) {
    const type = target.type.toLowerCase();
    if (type === 'button' || type === 'submit' || type === 'reset') {
      return true;
    }
    if (type === 'checkbox' || type === 'radio') {
      return true;
    }
  }

  return false;
}

export function isOverlayKeyboardTarget(event: React.KeyboardEvent<HTMLElement>): boolean {
  return event.target === event.currentTarget;
}
