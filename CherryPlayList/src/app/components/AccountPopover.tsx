import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import React, { useCallback, useEffect, useId, useRef, useState } from 'react';

import { ACCOUNT_POPOVER_OPEN_EVENT } from './accountPopoverEvents';
import { AccountView } from './AccountView';

import './AccountPopover.css';

interface AccountPopoverProps {
  isAuthenticated: boolean;
  organizerName?: string;
  disabled: boolean;
}

export const AccountPopover: React.FC<AccountPopoverProps> = ({
  isAuthenticated,
  organizerName,
  disabled,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const triggerId = useId();
  const panelId = useId();

  useEffect(() => {
    const openPopover = () => {
      if (disabled) return;
      returnFocusRef.current = document.activeElement instanceof HTMLElement
        ? document.activeElement
        : triggerRef.current;
      setIsOpen(true);
    };
    window.addEventListener(ACCOUNT_POPOVER_OPEN_EVENT, openPopover);
    return () => window.removeEventListener(ACCOUNT_POPOVER_OPEN_EVENT, openPopover);
  }, [disabled]);

  const closePopover = useCallback(() => {
    setIsOpen(false);
    const returnFocusTarget = returnFocusRef.current;
    (returnFocusTarget?.isConnected ? returnFocusTarget : triggerRef.current)?.focus();
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const panel = panelRef.current;
    if (!panel) return;
    const firstControl = panel.querySelector<HTMLElement>(
      'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    (firstControl ?? panel).focus();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        closePopover();
      }
    };

    document.addEventListener('pointerdown', closeOnOutsidePointer);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isOpen, closePopover]);

  return (
    <div className="account-popover" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        id={triggerId}
        className={`header-button${isAuthenticated ? ' header-button--account-authenticated' : ''}`}
        onClick={() => {
          if (isOpen) {
            closePopover();
            return;
          }
          returnFocusRef.current = triggerRef.current;
          setIsOpen(true);
        }}
        disabled={disabled}
        aria-label="Аккаунт"
        title={isAuthenticated ? `Аккаунт: ${organizerName || 'Организатор'}` : 'Войти в аккаунт'}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls={panelId}
      >
        <AccountCircleIcon className="header-button__icon" aria-hidden />
        {isAuthenticated && <span className="header-auth-dot" title="Авторизован" />}
      </button>
      {isOpen && (
        <div
          ref={panelRef}
          className="account-popover__panel"
          id={panelId}
          role="dialog"
          aria-labelledby={triggerId}
          tabIndex={-1}
        >
          <AccountView onClose={closePopover} />
        </div>
      )}
    </div>
  );
};
