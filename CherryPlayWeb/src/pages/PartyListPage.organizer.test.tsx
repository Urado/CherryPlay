import { cleanup, render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getAllParties = vi.hoisted(() => vi.fn());

vi.mock('@cherryplay/components', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
  FormInput: () => null,
  FormSelect: () => null,
  IconButton: ({ 'aria-label': ariaLabel, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button aria-label={ariaLabel} {...props} />
  ),
  formatDateInTimeZone: () => '2026-10-06',
  getDefaultTimeZone: () => 'UTC',
  getPopularTimeZones: () => [],
  sortPartiesByEventDateDesc: (parties: unknown[]) => parties,
}));

vi.mock('../contexts/AppConfigContext', () => ({
  useAppConfig: () => ({ partyInfoPageEnabled: false }),
}));

vi.mock('../contexts/ConsentGateContext', () => ({
  useConsentGate: () => ({ ensureConsents: vi.fn() }),
}));

vi.mock('../contexts/SiteAuthContext', () => ({
  useSiteAuth: () => ({ organizer: null, checked: true }),
}));

vi.mock('../services/partyApiService', () => ({
  partyApiService: { getAllParties },
}));

vi.mock('../components/ErrorMessage', () => ({ ErrorMessage: () => <div>Error</div> }));
vi.mock('../components/LoadingSpinner', () => ({ LoadingSpinner: () => <div>Loading</div> }));

import { PartyListPage } from './PartyListPage';

const createParty = (organizerName?: string | null) => ({
  id: 'party-id',
  name: 'Spring Party',
  shortCode: 'spring-26',
  partyThemeId: 'basic',
  hasActiveSession: false,
  createdAt: '2026-10-06T00:00:00Z',
  totalTracks: 0,
  totalDuration: 0,
  partyLifecycleState: 'ready' as const,
  organizerName,
});

describe('party list organizer name', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    getAllParties.mockReset();
  });

  it('shows a trimmed organizer name on the catalog card', async () => {
    getAllParties.mockResolvedValue([createParty('  Cherry Dance  ')]);

    render(
      <MemoryRouter>
        <PartyListPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Организатор: Cherry Dance')).toBeTruthy();
  });

  it.each([undefined, null, '', '   '])('omits an absent or blank organizer name (%s)', async (organizerName) => {
    getAllParties.mockResolvedValue([createParty(organizerName)]);

    render(
      <MemoryRouter>
        <PartyListPage />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('link', { name: 'Открыть вечеринку: Spring Party' })).toBeTruthy();
    expect(screen.queryByText(/Организатор:/)).toBeNull();
  });
});
