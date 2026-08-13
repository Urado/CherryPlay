import CloseIcon from '@mui/icons-material/Close';
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import {
  formatPartyProgramEndedReminderCountdown,
  usePartyProgramEndedStore,
} from './partyProgramEndedStore';

function useReminderClock(
  isActive: boolean,
  deadlineMs: number | null,
  onDeadlineReached: (deadlineMs: number) => void,
): number {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const notifiedDeadlineRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    const tick = () => {
      const now = Date.now();
      setNowMs(now);
      if (deadlineMs != null && now >= deadlineMs && notifiedDeadlineRef.current !== deadlineMs) {
        notifiedDeadlineRef.current = deadlineMs;
        onDeadlineReached(deadlineMs);
      }
    };

    const immediateId = window.setTimeout(tick, 0);
    const intervalId = window.setInterval(tick, 1000);
    return () => {
      window.clearTimeout(immediateId);
      window.clearInterval(intervalId);
    };
  }, [deadlineMs, isActive, onDeadlineReached]);

  return nowMs;
}

export const PartyProgramEndedReminder: React.FC = () => {
  const reminderVisible = usePartyProgramEndedStore((state) => state.reminderVisible);
  const reminderDeadlineMs = usePartyProgramEndedStore((state) => state.reminderDeadlineMs);
  const reminderMenuOpen = usePartyProgramEndedStore((state) => state.reminderMenuOpen);
  const dismissPartyProgramEndedReminder = usePartyProgramEndedStore(
    (state) => state.dismissPartyProgramEndedReminder,
  );
  const snoozePartyProgramEndedReminder = usePartyProgramEndedStore(
    (state) => state.snoozePartyProgramEndedReminder,
  );
  const setReminderMenuOpen = usePartyProgramEndedStore((state) => state.setReminderMenuOpen);

  const rootRef = useRef<HTMLDivElement>(null);
  const clockActive = reminderVisible && reminderDeadlineMs != null;

  const handleDeadlineReached = useCallback(
    (_deadlineMs: number) => {
      setReminderMenuOpen(true);
    },
    [setReminderMenuOpen],
  );

  const nowMs = useReminderClock(clockActive, reminderDeadlineMs, handleDeadlineReached);

  useLayoutEffect(() => {
    if (!reminderMenuOpen) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setReminderMenuOpen(false);
      }
    };
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target || rootRef.current?.contains(target)) {
        return;
      }
      setReminderMenuOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    const timer = window.setTimeout(() => window.addEventListener('click', handleClickOutside), 0);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.clearTimeout(timer);
      window.removeEventListener('click', handleClickOutside);
    };
  }, [reminderMenuOpen, setReminderMenuOpen]);

  if (!reminderVisible || reminderDeadlineMs == null) {
    return null;
  }

  const remainingMs = Math.max(0, reminderDeadlineMs - nowMs);
  const isDue = remainingMs <= 0;
  const countdown = formatPartyProgramEndedReminderCountdown(remainingMs);

  return (
    <div
      ref={rootRef}
      className={[
        'header-party-control__reminder',
        isDue ? 'header-party-control__reminder--due' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <button
        type="button"
        className={[
          'header-party-control__reminder-chip',
          isDue ? 'header-party-control__reminder-chip--due' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        aria-expanded={reminderMenuOpen}
        aria-haspopup="menu"
        title={
          isDue
            ? 'Напоминание: время вышло — выберите действие'
            : 'Напоминание: программа закончилась'
        }
        onClick={() => setReminderMenuOpen(!reminderMenuOpen)}
      >
        <span className="header-party-control__reminder-label">Напоминание</span>
        <span className="header-party-control__reminder-time" aria-live="polite">
          {countdown}
        </span>
      </button>
      <button
        type="button"
        className="header-party-control__reminder-dismiss"
        title="Закрыть напоминание"
        aria-label="Закрыть напоминание"
        onClick={(event) => {
          event.stopPropagation();
          dismissPartyProgramEndedReminder();
        }}
      >
        <CloseIcon fontSize="inherit" />
      </button>
      {reminderMenuOpen ? (
        <div className="header-party-control__reminder-menu" role="menu">
          <button
            type="button"
            className="header-party-control__reminder-menu-item"
            role="menuitem"
            onClick={() => snoozePartyProgramEndedReminder()}
          >
            Ещё подождать
          </button>
          <button
            type="button"
            className="header-party-control__reminder-menu-item"
            role="menuitem"
            onClick={() => dismissPartyProgramEndedReminder()}
          >
            Отменить
          </button>
        </div>
      ) : null}
    </div>
  );
};
