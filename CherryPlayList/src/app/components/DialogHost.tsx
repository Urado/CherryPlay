import { Button } from '@cherryplay/components';
import { useModalKeyboard } from '@shared/hooks';
import { dialogService } from '@shared/services/dialogService';
import React, { useCallback, useEffect, useId, useRef, useSyncExternalStore } from 'react';

export const DialogHost: React.FC = () => {
  const request = useSyncExternalStore(
    dialogService.subscribe,
    dialogService.getSnapshot,
    dialogService.getSnapshot,
  );
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const messageId = useId();
  const close = useCallback(
    (confirmed: boolean) => {
      if (request) {
        dialogService.close(request.id, confirmed);
      }
    },
    [request],
  );
  const { handleOverlayKeyDown } = useModalKeyboard({
    enabled: request !== null,
    onCancel: () => close(false),
    onPrimary: () => close(true),
  });

  useEffect(() => {
    if (!request) {
      return;
    }
    const previousFocus = document.activeElement;
    const timeoutId = window.setTimeout(() => cancelButtonRef.current?.focus(), 0);
    return () => {
      window.clearTimeout(timeoutId);
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus();
      }
    };
  }, [request]);

  if (!request) {
    return null;
  }

  const isAlert = request.type === 'alert';
  const confirmLabel = request.confirmLabel ?? (isAlert ? 'Понятно' : 'Подтвердить');
  const cancelLabel = isAlert ? null : (request.cancelLabel ?? 'Отмена');

  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    if (event.key !== 'Tab') {
      return;
    }
    const focusable = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled])'),
    );
    if (focusable.length === 0) {
      event.preventDefault();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  };

  return (
    <div
      className="modal-overlay"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          close(false);
        }
      }}
      onKeyDown={handleOverlayKeyDown}
    >
      <div
        className="modal-content"
        role={isAlert ? 'alertdialog' : 'dialog'}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
        onKeyDown={handleTabKeyDown}
      >
        <div className="modal-header">
          <h2 className="modal-title" id={titleId}>
            {request.title}
          </h2>
        </div>
        <div className="modal-body">
          <p id={messageId}>{request.message}</p>
        </div>
        <div className="modal-footer">
          {cancelLabel ? (
            <Button
              className="modal-button"
              type="button"
              onClick={() => close(false)}
              variant="secondary"
              size="sm"
              ref={cancelButtonRef}
            >
              {cancelLabel}
            </Button>
          ) : null}
          <Button
            className="modal-button"
            type="button"
            onClick={() => close(true)}
            variant={request.type === 'confirm' && request.destructive ? 'danger' : 'primary'}
            size="sm"
            ref={isAlert ? cancelButtonRef : undefined}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
};
