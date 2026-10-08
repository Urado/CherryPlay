import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PartyPlaylistDto, PublicPartyDto } from '../types/api';

const mockGetPartyPlaylist = vi.fn();
const mockGetPublicParty = vi.fn();

vi.mock('../services/partyApiService', () => ({
  partyApiService: {
    getPartyPlaylist: mockGetPartyPlaylist,
    getPublicParty: mockGetPublicParty,
    getFirstPartyPlaylist: vi.fn(),
  },
}));

const emptyPlaylist: PartyPlaylistDto = {
  items: [],
  totalDuration: 0,
  totalTracks: 0,
};

const publicParty = (groupDisplayDepth?: number): PublicPartyDto => ({
  id: 'party-1',
  name: 'Test Party',
  partyThemeId: 'basic',
  customizationSettings:
    groupDisplayDepth === undefined ? undefined : { groupDisplayDepth },
  hasActiveSession: false,
  isListedInCatalog: true,
  partyLifecycleState: 'ready',
  partyDisplayStatus: 'scheduled',
});

describe('usePartyState group display depth', () => {
  beforeEach(() => {
    mockGetPartyPlaylist.mockReset();
    mockGetPublicParty.mockReset();
    mockGetPartyPlaylist.mockResolvedValue(emptyPlaylist);
  });

  it('reads the public party depth from customization JSON', async () => {
    mockGetPublicParty.mockResolvedValue(publicParty(7));
    const { usePartyState } = await import('./usePartyState');
    const { result } = renderHook(() => usePartyState({ shortCode: 'abc123' }));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.groupDisplayDepth).toBe(7);
  });

  it('uses depth three when public customization JSON omits the setting', async () => {
    mockGetPublicParty.mockResolvedValue(publicParty());
    const { usePartyState } = await import('./usePartyState');
    const { result } = renderHook(() => usePartyState({ shortCode: 'legacy1' }));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.groupDisplayDepth).toBe(3);
  });
});
