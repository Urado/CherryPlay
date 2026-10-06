import { render, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getAllParties: vi.fn(),
  checkAuth: vi.fn(),
  connect: vi.fn(),
}));

vi.mock('@cherryplay/components', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
  IconButton: ({ 'aria-label': ariaLabel, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button aria-label={ariaLabel} {...props} />
  ),
  PartyDisplay: () => <div>Party display</div>,
  formatDateInTimeZone: () => '2026-10-06',
  getDefaultTimeZone: () => 'UTC',
  getPopularTimeZones: () => [],
  sortPartiesByEventDateDesc: (parties: unknown[]) => parties,
  mergePartyViewerStatus: () => ({ id: 'connected' }),
  usePartyThemeVars: () => ({}),
}));

vi.mock('../contexts/AppConfigContext', () => ({
  useAppConfig: () => ({ partyInfoPageEnabled: false }),
}));

vi.mock('../contexts/ConsentGateContext', () => ({
  useConsentGate: () => ({ ensureConsents: vi.fn() }),
}));

vi.mock('../services/authService', () => ({
  authService: { checkAuth: mocks.checkAuth },
}));

vi.mock('../services/partyApiService', () => ({
  partyApiService: { getAllParties: mocks.getAllParties },
}));

vi.mock('../components/SiteFooter', () => ({ SiteFooter: () => null }));
vi.mock('../components/LoadingSpinner', () => ({ LoadingSpinner: () => <div>Loading</div> }));
vi.mock('../components/ErrorMessage', () => ({ ErrorMessage: () => <div>Error</div> }));

vi.mock('../hooks/usePartyState', () => ({
  usePartyState: () => ({
    playlist: { items: [], totalDuration: 0, totalTracks: 0 },
    loading: false,
    error: null,
    partyName: 'Spring Party',
    partyTitle: null,
    partySubtitle: null,
    partyId: 'party-id',
    themeId: 'basic',
    customizationSettings: {},
    playbackState: null,
    isSessionActive: false,
    partyDisplayStatus: null,
    apiReachable: true,
    loadPlaylist: vi.fn(),
    setPlaylist: vi.fn(),
    setPlaybackState: vi.fn(),
    setIsSessionActive: vi.fn(),
    setPartyDisplayStatus: vi.fn(),
    setApiReachable: vi.fn(),
    setError: vi.fn(),
  }),
}));

vi.mock('../hooks/useSignalR', () => ({
  useSignalR: () => ({
    connectionStatus: 'connected',
    isConnected: true,
    connect: mocks.connect,
  }),
}));

vi.mock('../services/signalRService', () => ({
  signalRService: {
    isServiceConnected: () => false,
    requestFullState: vi.fn(),
    onPlaybackStateReset: vi.fn(),
    off: vi.fn(),
  },
}));

import { PartyListPage } from './PartyListPage';
import { PartyView } from './PartyView';

describe('party navigation pages', () => {
  beforeEach(() => {
    mocks.getAllParties.mockReset();
    mocks.checkAuth.mockReset();
    mocks.connect.mockReset().mockResolvedValue(undefined);
  });

  it('renders a catalog card route separately from its external link', async () => {
    mocks.getAllParties.mockResolvedValue([
      {
        id: 'party-id',
        name: 'Spring Party',
        shortCode: 'spring-26',
        partyThemeId: 'basic',
        hasActiveSession: false,
        createdAt: '2026-10-06T00:00:00Z',
        totalTracks: 0,
        totalDuration: 0,
        partyLifecycleState: 'published',
        externalLinkUrl: 'https://example.com/event',
        externalLinkText: 'Event details',
      },
    ]);
    mocks.checkAuth.mockResolvedValue(null);

    const view = render(
      <MemoryRouter>
        <PartyListPage />
      </MemoryRouter>,
    );

    const card = await view.findByRole('link', { name: 'Открыть вечеринку: Spring Party' });
    const externalLink = view.getByRole('link', { name: 'Event details' });

    expect(card.getAttribute('href')).toBe('/party/spring-26');
    expect(card.hasAttribute('target')).toBe(false);
    expect(externalLink.getAttribute('href')).toBe('https://example.com/event');
    expect(externalLink.getAttribute('target')).toBe('_blank');
    expect(card.contains(externalLink)).toBe(false);
  });

  it('shows the back link on a loaded non-demo party route', async () => {
    const view = render(
      <MemoryRouter initialEntries={['/party/spring-26']}>
        <Routes>
          <Route path="/party/:shortCode" element={<PartyView shortCode="spring-26" />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(view.getByRole('link', { name: /Список вечеринок/ }).getAttribute('href')).toBe('/');
    });
  });
});
