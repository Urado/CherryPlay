import {
  clearPartyProgramEnded,
  formatPartyProgramEndedReminderCountdown,
  markPartyProgramEnded,
  PARTY_PROGRAM_ENDED_REMINDER_BASE_MS,
  resolvePartyProgramEndedSnoozeIntervalMs,
  usePartyProgramEndedStore,
} from '../../src/workspaces/party/partyProgramEndedStore';

describe('partyProgramEndedStore', () => {
  beforeEach(() => {
    clearPartyProgramEnded();
  });

  it('resolves exponential snooze intervals from a 20 minute base', () => {
    expect(resolvePartyProgramEndedSnoozeIntervalMs(0)).toBe(PARTY_PROGRAM_ENDED_REMINDER_BASE_MS);
    expect(resolvePartyProgramEndedSnoozeIntervalMs(1)).toBe(
      PARTY_PROGRAM_ENDED_REMINDER_BASE_MS * 2,
    );
    expect(resolvePartyProgramEndedSnoozeIntervalMs(2)).toBe(
      PARTY_PROGRAM_ENDED_REMINDER_BASE_MS * 4,
    );
    expect(resolvePartyProgramEndedSnoozeIntervalMs(-3)).toBe(PARTY_PROGRAM_ENDED_REMINDER_BASE_MS);
  });

  it('formats countdown as m:ss', () => {
    expect(formatPartyProgramEndedReminderCountdown(20 * 60 * 1000)).toBe('20:00');
    expect(formatPartyProgramEndedReminderCountdown(61_000)).toBe('1:01');
    expect(formatPartyProgramEndedReminderCountdown(500)).toBe('0:01');
    expect(formatPartyProgramEndedReminderCountdown(0)).toBe('0:00');
  });

  it('marks program ended and starts the first reminder window', () => {
    const nowMs = 1_000_000;
    markPartyProgramEnded(nowMs);
    const state = usePartyProgramEndedStore.getState();
    expect(state.programEnded).toBe(true);
    expect(state.reminderVisible).toBe(true);
    expect(state.snoozeStepIndex).toBe(0);
    expect(state.reminderDeadlineMs).toBe(nowMs + PARTY_PROGRAM_ENDED_REMINDER_BASE_MS);
  });

  it('snoozes exponentially without clearing programEnded', () => {
    const nowMs = 2_000_000;
    markPartyProgramEnded(nowMs);
    usePartyProgramEndedStore.getState().snoozePartyProgramEndedReminder(nowMs + 10);
    let state = usePartyProgramEndedStore.getState();
    expect(state.programEnded).toBe(true);
    expect(state.snoozeStepIndex).toBe(1);
    expect(state.reminderDeadlineMs).toBe(nowMs + 10 + PARTY_PROGRAM_ENDED_REMINDER_BASE_MS * 2);

    usePartyProgramEndedStore.getState().snoozePartyProgramEndedReminder(nowMs + 20);
    state = usePartyProgramEndedStore.getState();
    expect(state.snoozeStepIndex).toBe(2);
    expect(state.reminderDeadlineMs).toBe(nowMs + 20 + PARTY_PROGRAM_ENDED_REMINDER_BASE_MS * 4);
  });

  it('dismiss hides the reminder but keeps programEnded', () => {
    markPartyProgramEnded(3_000_000);
    usePartyProgramEndedStore.getState().dismissPartyProgramEndedReminder();
    expect(usePartyProgramEndedStore.getState()).toMatchObject({
      programEnded: true,
      reminderVisible: false,
      reminderDeadlineMs: null,
    });
  });

  it('clearPartyProgramEnded resets status and reminder', () => {
    markPartyProgramEnded(5_000_000);
    clearPartyProgramEnded();
    expect(usePartyProgramEndedStore.getState()).toMatchObject({
      programEnded: false,
      reminderVisible: false,
      reminderMenuOpen: false,
      reminderDeadlineMs: null,
      snoozeStepIndex: 0,
    });
  });
});
