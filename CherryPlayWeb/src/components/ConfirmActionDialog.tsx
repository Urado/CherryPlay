import { Button } from '@cherryplay/components';
import { useEffect, useId, useRef, type KeyboardEvent, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';

import './ConfirmActionDialog.css';

export interface ConfirmActionDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  confirming?: boolean;
  confirmVariant?: 'danger' | 'primary' | 'secondary';
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmActionDialog = ({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Отмена',
  confirming = false,
  confirmVariant = 'danger',
  onConfirm,
  onCancel,
}: ConfirmActionDialogProps) => {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const onCancelRef = useRef(onCancel);
  const confirmingRef = useRef(confirming);

  useEffect(() => {
    onCancelRef.current = onCancel;
    confirmingRef.current = confirming;
  }, [onCancel, confirming]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const appRoot = document.getElementById('root');
    appRoot?.setAttribute('inert', '');
    appRoot?.setAttribute('aria-hidden', 'true');

    const cancelButton =
      cancelButtonRef.current ??
      dialogRef.current?.querySelector<HTMLElement>('button[data-confirm-cancel]');
    cancelButton?.focus();

    const onDocumentKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      if (!confirmingRef.current) {
        onCancelRef.current();
      }
    };

    document.addEventListener('keydown', onDocumentKeyDown, true);

    return () => {
      document.removeEventListener('keydown', onDocumentKeyDown, true);
      appRoot?.removeAttribute('inert');
      appRoot?.removeAttribute('aria-hidden');
      previouslyFocused?.focus();
    };
  }, [open]);

  if (!open) {
    return null;
  }

  const trapFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab') {
      return;
    }

    const focusable = event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled])');
    if (focusable.length === 0) {
      event.preventDefault();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const ignoreBackdropClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      event.preventDefault();
    }
  };

  return createPortal(
    <div
      ref={dialogRef}
      className="confirm-action-backdrop"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      tabIndex={-1}
      onKeyDown={trapFocus}
      onMouseDown={ignoreBackdropClick}
    >
      <div className="confirm-action-modal">
        <h2 id={titleId} className="confirm-action-title">
          {title}
        </h2>
        <p id={descriptionId} className="confirm-action-description">
          {description}
        </p>
        <div className="confirm-action-actions">
          <Button
            ref={cancelButtonRef}
            type="button"
            variant="secondary"
            size="sm"
            disabled={confirming}
            data-confirm-cancel=""
            onClick={onCancel}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={confirmVariant}
            size="sm"
            loading={confirming}
            disabled={confirming}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
};
