import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
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

  it('offers only the archive action', () => {
    render(<PartyProgramEndedReminder />);

    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Архивировать. Таймер' })).toBeVisible();
  });

  it('archives only after the user activates the button', () => {
    render(<PartyProgramEndedReminder />);
    fireEvent.click(screen.getByRole('button', { name: 'Архивировать. Таймер' }));

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
