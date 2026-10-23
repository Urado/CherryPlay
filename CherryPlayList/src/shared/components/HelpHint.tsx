import { IconButton, InfoIcon } from '@cherryplay/components';
import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { useModalKeyboard } from '../hooks/useModalKeyboard';

import './HelpHint.css';

interface HelpHintProps {
  label: string;
  children: React.ReactNode;
}

export const HelpHint = ({ label, children }: HelpHintProps) => {
  const tooltipId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pinned = useRef(false);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0 });

  const cancelClose = useCallback(() => {
    if (closeTimer.current !== null) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const close = useCallback(() => {
    cancelClose();
    pinned.current = false;
    setOpen(false);
  }, [cancelClose]);

  const leave = () => {
    if (pinned.current || document.activeElement === triggerRef.current) {
      return;
    }
    cancelClose();
    closeTimer.current = setTimeout(close, 180);
  };

  useModalKeyboard({ enabled: open, onCancel: close });
  useEffect(() => cancelClose, [cancelClose]);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current || !tooltipRef.current) {
      return;
    }
    const anchor = triggerRef.current.getBoundingClientRect();
    const tooltip = tooltipRef.current.getBoundingClientRect();
    setPosition({
      left: Math.max(12, Math.min(anchor.left, window.innerWidth - tooltip.width - 12)),
      top:
        anchor.bottom + tooltip.height + 8 <= window.innerHeight - 12
          ? anchor.bottom + 8
          : Math.max(12, anchor.top - tooltip.height - 8),
    });
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onPointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !triggerRef.current?.contains(event.target) &&
        !tooltipRef.current?.contains(event.target)
      ) {
        close();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open, close]);

  return (
    <span className="help-hint">
      <IconButton
        ref={triggerRef}
        type="button"
        variant="ghost"
        size="sm"
        borderless
        icon={<InfoIcon title={label} aria-hidden />}
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? tooltipId : undefined}
        onPointerEnter={(event) => {
          if (event.pointerType !== 'touch') {
            cancelClose();
            setOpen(true);
          }
        }}
        onPointerLeave={leave}
        onFocus={() => setOpen(true)}
        onBlur={close}
        onClick={() => {
          if (pinned.current) {
            close();
          } else {
            cancelClose();
            pinned.current = true;
            setOpen(true);
          }
        }}
      />
      {open &&
        createPortal(
          <div
            ref={tooltipRef}
            className="help-hint__content"
            id={tooltipId}
            role="tooltip"
            style={position}
            onPointerEnter={cancelClose}
            onPointerLeave={leave}
          >
            {children}
          </div>,
          document.body,
        )}
    </span>
  );
};
