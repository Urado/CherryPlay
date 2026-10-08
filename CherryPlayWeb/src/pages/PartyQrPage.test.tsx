import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getPublicParty: vi.fn(),
  resolvePartyQrStyle: vi.fn(),
  signalRConnect: vi.fn(),
  requestFullState: vi.fn(),
}));

vi.mock('@cherryplay/components', () => ({
  DEFAULT_PARTY_THEME_ID: 'basic',
  isValidPartyTheme: (themeId: string) =>
    ['basic', 'cyberpunk', 'sakura', 'art-deco', 'spring-cross-step'].includes(themeId),
  PartyQrCode: ({
    value,
    title,
    style,
    logoSrc,
  }: {
    value: string;
    title: string;
    style: Record<string, string>;
    logoSrc?: string;
  }) => (
    <div
      data-testid="party-qr-code"
      data-value={value}
      data-title={title}
      data-style={JSON.stringify(style)}
      data-logo-src={logoSrc ?? ''}
    />
  ),
  PartyDisplay: () => null,
  mergePartyViewerStatus: () => ({ id: 'connected' }),
  resolvePartyQrImage: (themeId: string, settings?: Record<string, unknown>) =>
    typeof settings?.qrLogoUrl === 'string' && settings.qrLogoUrl.trim()
      ? settings.qrLogoUrl.trim()
      : themeId === 'spring-cross-step'
        ? '/images/spring-cross-step-poster.jpg'
        : undefined,
  resolvePartyQrStyle: mocks.resolvePartyQrStyle,
  usePartyThemeVars: () => ({}),
}));

vi.mock('../contexts/AppConfigContext', () => ({
  useAppConfig: () => ({ partyInfoPageEnabled: false }),
}));

vi.mock('../hooks/usePartyState', () => ({
  usePartyState: () => ({
    playlist: { items: [], totalDuration: 0, totalTracks: 0 },
    loading: false,
    error: null,
    partyName: 'Theme Party',
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
    connect: mocks.signalRConnect,
  }),
}));

vi.mock('../services/signalRService', () => ({
  signalRService: {
    isServiceConnected: () => false,
    requestFullState: mocks.requestFullState,
    onPlaybackStateReset: vi.fn(),
    off: vi.fn(),
  },
}));

vi.mock('../components/SiteFooter', () => ({ SiteFooter: () => null }));
vi.mock('../services/partyApiService', () => ({
  partyApiService: { getPublicParty: mocks.getPublicParty },
}));

import { ROUTES } from '../constants/routes';
import type { PublicPartyDto } from '../types/api';

import { PartyQrPage } from './PartyQrPage';
import { PartyView } from './PartyView';

const makeParty = (partyThemeId: string): PublicPartyDto => ({
  id: 'party-id',
  name: 'Theme Party',
  title: 'Theme Party QR',
  partyThemeId,
  customizationSettings: {
    paletteId: 'custom',
    customPalette: {
      accentPrimary: '#c2006c',
      textPrimary: '#610036',
      backgroundPrimary: '#fae8f2',
      trackAreaBackground: '#fff7fb',
      trackBackground: '#fff1f7',
    },
  },
  hasActiveSession: false,
  isListedInCatalog: true,
  partyLifecycleState: 'ready',
  partyDisplayStatus: 'live',
});

const renderRoute = (shortCode: string) =>
  render(
    <MemoryRouter initialEntries={[ROUTES.PARTY_QR(shortCode)]}>
      <Routes>
        <Route path="/party/:shortCode/qr" element={<PartyQrPage />} />
      </Routes>
    </MemoryRouter>,
  );

describe('PartyQrPage', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    mocks.getPublicParty.mockReset();
    mocks.resolvePartyQrStyle.mockReset().mockReturnValue({
      foreground: '#610036',
      background: '#fae8f2',
      accent: '#c2006c',
      frame: 'simple',
    });
  });

  it('loads a party route, links back to the party and encodes its public URL', async () => {
    const party = makeParty('basic');
    mocks.getPublicParty.mockResolvedValue(party);

    renderRoute('night-2026');

    const qr = await screen.findByTestId('party-qr-code');
    await waitFor(() => expect(mocks.getPublicParty).toHaveBeenCalledWith('night-2026'));

    expect(qr.getAttribute('data-value')).toBe(`${window.location.origin}/party/night-2026`);
    expect(qr.getAttribute('data-title')).toBe('Theme Party QR');
    expect(screen.getByRole('link', { name: '← К вечеринке' }).getAttribute('href')).toBe('/party/night-2026');
    expect(mocks.resolvePartyQrStyle).toHaveBeenCalledWith('basic', party.customizationSettings);
    expect(ROUTES.PARTY_QR('night-2026')).toBe('/party/night-2026/qr');
  });

  it('passes the Spring party poster as the center image', async () => {
    mocks.getPublicParty.mockResolvedValue(makeParty('spring-cross-step'));

    renderRoute('spring-party');

    const qr = await screen.findByTestId('party-qr-code');

    expect(qr.getAttribute('data-logo-src')).toBe('/images/spring-cross-step-poster.jpg');
    expect(mocks.resolvePartyQrStyle).toHaveBeenCalledWith('spring-cross-step', expect.any(Object));
  });

  it('links from the party header to that party QR route', () => {
    render(
      <MemoryRouter>
        <PartyView shortCode="night-2026" />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'QR-код' }).getAttribute('href')).toBe('/party/night-2026/qr');
  });
});
