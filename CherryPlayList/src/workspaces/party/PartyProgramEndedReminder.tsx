import React, { useEffect, useState } from 'react';

import { archivePartyFromHeader } from './partyHeaderCommands';
import {
  formatPartyProgramEndedReminderCountdown,
  usePartyProgramEndedStore,
} from './partyProgramEndedStore';

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
  const clockActive = reminderVisible && reminderDeadlineMs != null;
  const nowMs = useReminderClock(clockActive, reminderDeadlineMs);

  if (!reminderVisible || reminderDeadlineMs == null) {
    return null;
  }

  const remainingMs = Math.max(0, reminderDeadlineMs - nowMs);
  const isDue = remainingMs <= 0;
  const countdown = formatPartyProgramEndedReminderCountdown(remainingMs);

  return (
    <div className="header-party-control__reminder">
      <button
        type="button"
        className={[
          'header-party-control__reminder-chip',
          isDue ? 'header-party-control__reminder-chip--due' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        aria-label={isDue ? 'Архивировать. Время вышло' : 'Архивировать. Таймер'}
        title={isDue ? 'Архивировать: время вышло' : 'Архивировать: программа закончилась'}
        onClick={() => void archivePartyFromHeader()}
      >
        <span className="header-party-control__reminder-label">Архивировать</span>
        <span className="header-party-control__reminder-time" aria-live="polite">
          {countdown}
        </span>
      </button>
    </div>
  );
};
