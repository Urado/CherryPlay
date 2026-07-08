import { useCallback, useEffect, useRef } from 'react';

import { isOverlayKeyboardTarget, shouldIgnoreEnterForPrimary } from '@shared/utils/modalKeyboard';

export interface UseModalKeyboardOptions {
  enabled: boolean;
  onCancel: () => void;
  onPrimary?: () => void;
  primaryDisabled?: boolean;
}

const modalKeyboardStack: symbol[] = [];

function isModalOverlayElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return target.classList.contains('modal-overlay');
}

export function useModalKeyboard({
  enabled,
  onCancel,
  onPrimary,
  primaryDisabled = false,
}: UseModalKeyboardOptions) {
  const modalIdRef = useRef<symbol>(Symbol('modalKeyboard'));
  const onCancelRef = useRef(onCancel);
  const onPrimaryRef = useRef(onPrimary);

  useEffect(() => {
    onCancelRef.current = onCancel;
  }, [onCancel]);

  useEffect(() => {
    onPrimaryRef.current = onPrimary;
  }, [onPrimary]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const handleDocumentKeyDown = (event: KeyboardEvent) => {
      const currentTop = modalKeyboardStack[modalKeyboardStack.length - 1];
      if (currentTop !== modalIdRef.current) {
        return;
      }

      if (event.key === 'Escape') {
        if (event.defaultPrevented) {
          return;
        }

        event.preventDefault();
        onCancelRef.current();
        return;
      }

      if (
        event.key !== 'Enter' ||
        event.shiftKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey
      ) {
        return;
      }

      const primary = onPrimaryRef.current;
      if (!primary || primaryDisabled) {
        return;
      }

      if (event.defaultPrevented) {
        return;
      }

      if (isModalOverlayElement(event.target) || shouldIgnoreEnterForPrimary(event.target)) {
        return;
      }

      event.preventDefault();
      primary();
    };

    document.addEventListener('keydown', handleDocumentKeyDown);
    return () => {
      document.removeEventListener('keydown', handleDocumentKeyDown);
    };
  }, [enabled, primaryDisabled]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const modalId = modalIdRef.current;
    modalKeyboardStack.push(modalId);

    return () => {
      const index = modalKeyboardStack.lastIndexOf(modalId);
      if (index !== -1) {
        modalKeyboardStack.splice(index, 1);
      }
    };
  }, [enabled]);

  const handleOverlayKeyDown = useCallback((event: React.KeyboardEvent<HTMLElement>) => {
    if (!isOverlayKeyboardTarget(event)) {
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
    }
  }, []);

  return { handleOverlayKeyDown };
}
