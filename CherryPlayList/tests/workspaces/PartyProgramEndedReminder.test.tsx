import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import React from 'react';

const mockArchivePartyFromHeader = jest.fn();

jest.mock('../../src/workspaces/party/partyHeaderCommands', () => ({
  archivePartyFromHeader: (...args: unknown[]) => mockArchivePartyFromHeader(...args),
}));

import { PartyProgramEndedReminder } from '../../src/workspaces/party/PartyProgramEndedReminder';
import {
  clearPartyProgramEnded,
  markPartyProgramEnded,
  PARTY_PROGRAM_ENDED_REMINDER_BASE_MS,
} from '../../src/workspaces/party/partyProgramEndedStore';

describe('PartyProgramEndedReminder', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-10-06T12:00:00.000Z'));
    clearPartyProgramEnded();
    markPartyProgramEnded(Date.now());
    mockArchivePartyFromHeader.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('offers archive and dismiss actions', () => {
    render(<PartyProgramEndedReminder />);

    expect(screen.getAllByRole('button')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Архивировать. Таймер' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Скрыть напоминание об архивировании' })).toBeVisible();
  });

  it('archives only after the user confirms the action', () => {
    render(<PartyProgramEndedReminder />);
    fireEvent.click(screen.getByRole('button', { name: 'Архивировать. Таймер' }));

    const dialog = screen.getByRole('alertdialog');
    expect(mockArchivePartyFromHeader).not.toHaveBeenCalled();
    expect(within(dialog).getByRole('button', { name: 'Отмена' })).toBeVisible();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Архивировать' }));

    expect(mockArchivePartyFromHeader).toHaveBeenCalledTimes(1);
  });

  it('does not archive automatically when the timer reaches zero', () => {
    render(<PartyProgramEndedReminder />);

    act(() => {
      jest.advanceTimersByTime(PARTY_PROGRAM_ENDED_REMINDER_BASE_MS);
    });

    expect(mockArchivePartyFromHeader).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Архивировать. Время вышло' })).toBeVisible();
  });
});
