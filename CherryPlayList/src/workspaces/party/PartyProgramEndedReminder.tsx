import React, { useEffect, useRef, useState } from 'react';

import { archivePartyFromHeader } from './partyHeaderCommands';
import {
  formatPartyProgramEndedReminderCountdown,
  usePartyProgramEndedStore,
} from './partyProgramEndedStore';
import { PARTY_ARCHIVE_CONFIRM_MESSAGE } from './resolvePartyArchiveAvailability';

function useReminderClock(isActive: boolean, deadlineMs: number | null): number {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!isActive) {
      return;
    }

    const tick = () => setNowMs(Date.now());
    const immediateId = window.setTimeout(tick, 0);
    const intervalId = window.setInterval(tick, 1000);
    return () => {
      window.clearTimeout(immediateId);
      window.clearInterval(intervalId);
    };
  }, [deadlineMs, isActive]);

  return nowMs;
}

export const PartyProgramEndedReminder: React.FC = () => {
  const reminderVisible = usePartyProgramEndedStore((state) => state.reminderVisible);
  const reminderDeadlineMs = usePartyProgramEndedStore((state) => state.reminderDeadlineMs);
  const dismissReminder = usePartyProgramEndedStore(
    (state) => state.dismissPartyProgramEndedReminder,
  );
  const clockActive = reminderVisible && reminderDeadlineMs != null;
  const nowMs = useReminderClock(clockActive, reminderDeadlineMs);
  const [archiveConfirmationOpen, setArchiveConfirmationOpen] = useState(false);
  const archiveTriggerRef = useRef<HTMLButtonElement>(null);
  const archiveDialogRef = useRef<HTMLDivElement>(null);
  const archiveCancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!archiveConfirmationOpen) {
      return;
    }

    archiveCancelRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setArchiveConfirmationOpen(false);
        window.requestAnimationFrame(() => archiveTriggerRef.current?.focus());
        return;
      }
      if (event.key !== 'Tab') {
        return;
      }
      const focusableElements = archiveDialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusableElements?.length) {
        event.preventDefault();
        return;
      }
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;
      if (event.shiftKey && (activeElement === firstElement || !archiveDialogRef.current?.contains(activeElement))) {
        event.preventDefault();
        lastElement.focus();
      } else if (
        !event.shiftKey &&
        (activeElement === lastElement || !archiveDialogRef.current?.contains(activeElement))
      ) {
        event.preventDefault();
        firstElement.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [archiveConfirmationOpen]);

  const closeArchiveConfirmation = () => {
    setArchiveConfirmationOpen(false);
    window.requestAnimationFrame(() => archiveTriggerRef.current?.focus());
  };

  if (!reminderVisible || reminderDeadlineMs == null) {
    return null;
  }

  const remainingMs = Math.max(0, reminderDeadlineMs - nowMs);
  const isDue = remainingMs <= 0;
  const countdown = formatPartyProgramEndedReminderCountdown(remainingMs);

  return (
    <div className="header-party-control__reminder">
      <button
        ref={archiveTriggerRef}
        type="button"
        className={[
          'header-party-control__reminder-chip',
          isDue ? 'header-party-control__reminder-chip--due' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        aria-label={isDue ? 'Архивировать. Время вышло' : 'Архивировать. Таймер'}
        title={isDue ? 'Архивировать: время вышло' : 'Архивировать: программа закончилась'}
        onClick={() => setArchiveConfirmationOpen(true)}
      >
        <span className="header-party-control__reminder-label">Архивировать</span>
        <span className="header-party-control__reminder-time" aria-live="polite">
          {countdown}
        </span>
      </button>
      <button
        type="button"
        className="header-party-control__reminder-dismiss"
        aria-label="Скрыть напоминание об архивировании"
        title="Скрыть напоминание"
        onClick={dismissReminder}
      >
        ×
      </button>
      {archiveConfirmationOpen ? (
        <div
          className="header-party-control__archive-confirm-overlay"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closeArchiveConfirmation();
            }
          }}
          role="presentation"
        >
          <div
            ref={archiveDialogRef}
            className="header-party-control__archive-confirm"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="header-party-archive-confirm-title"
            aria-describedby="header-party-archive-confirm-description"
          >
            <h2 id="header-party-archive-confirm-title">Отправить вечеринку в архив?</h2>
            <p id="header-party-archive-confirm-description">{PARTY_ARCHIVE_CONFIRM_MESSAGE}</p>
            <div className="header-party-control__archive-confirm-actions">
              <button
                ref={archiveCancelRef}
                type="button"
                className="header-party-control__archive-confirm-cancel"
                onClick={closeArchiveConfirmation}
              >
                Отмена
              </button>
              <button
                type="button"
                className="header-party-control__archive-confirm-submit"
                onClick={() => {
                  closeArchiveConfirmation();
                  void archivePartyFromHeader();
                }}
              >
                Архивировать
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
