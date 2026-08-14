import { createWithEqualityFn } from 'zustand/traditional';

export const PARTY_PROGRAM_ENDED_REMINDER_BASE_MS = 20 * 60 * 1000;

export function resolvePartyProgramEndedSnoozeIntervalMs(snoozeStepIndex: number): number {
  const step = Math.max(0, Math.floor(snoozeStepIndex));
  return PARTY_PROGRAM_ENDED_REMINDER_BASE_MS * 2 ** step;
}

export function formatPartyProgramEndedReminderCountdown(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export interface PartyProgramEndedState {
  programEnded: boolean;
  reminderVisible: boolean;
  reminderMenuOpen: boolean;
  reminderDeadlineMs: number | null;
  snoozeStepIndex: number;
  markPartyProgramEnded: (nowMs?: number) => void;
  clearPartyProgramEnded: () => void;
  dismissPartyProgramEndedReminder: () => void;
  snoozePartyProgramEndedReminder: (nowMs?: number) => void;
  setReminderMenuOpen: (open: boolean) => void;
}

const CLEARED_REMINDER = {
  reminderVisible: false,
  reminderMenuOpen: false,
  reminderDeadlineMs: null as number | null,
  snoozeStepIndex: 0,
};

export const usePartyProgramEndedStore = createWithEqualityFn<PartyProgramEndedState>(
  (set, get) => ({
    programEnded: false,
    ...CLEARED_REMINDER,

    markPartyProgramEnded: (nowMs = Date.now()) => {
      if (get().programEnded) {
        return;
      }
      set({
        programEnded: true,
        reminderVisible: true,
        reminderMenuOpen: false,
        snoozeStepIndex: 0,
        reminderDeadlineMs: nowMs + resolvePartyProgramEndedSnoozeIntervalMs(0),
      });
    },

    clearPartyProgramEnded: () => {
      set({
        programEnded: false,
        ...CLEARED_REMINDER,
      });
    },

    dismissPartyProgramEndedReminder: () => {
      set({
        reminderVisible: false,
        reminderMenuOpen: false,
        reminderDeadlineMs: null,
      });
    },

    snoozePartyProgramEndedReminder: (nowMs = Date.now()) => {
      const nextStep = get().snoozeStepIndex + 1;
      set({
        reminderVisible: true,
        reminderMenuOpen: false,
        snoozeStepIndex: nextStep,
        reminderDeadlineMs: nowMs + resolvePartyProgramEndedSnoozeIntervalMs(nextStep),
      });
    },

    setReminderMenuOpen: (reminderMenuOpen) => set({ reminderMenuOpen }),
  }),
);

export function markPartyProgramEnded(nowMs?: number): void {
  usePartyProgramEndedStore.getState().markPartyProgramEnded(nowMs);
}

export function clearPartyProgramEnded(): void {
  usePartyProgramEndedStore.getState().clearPartyProgramEnded();
}
