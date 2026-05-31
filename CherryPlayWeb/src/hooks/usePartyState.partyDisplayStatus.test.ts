/**
 * @vitest-environment jsdom
 */
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

function buildPublicParty(partyDisplayStatus: string): PublicPartyDto {
  return {
    id: 'party-1',
    name: 'Test Party',
    partyThemeId: 'cyberpunk',
    hasActiveSession: false,
    isListedInCatalog: true,
    partyLifecycleState: 'ready',
    partyDisplayStatus: partyDisplayStatus as PublicPartyDto['partyDisplayStatus'],
  };
}

describe('usePartyState partyDisplayStatus from public party API', () => {
  beforeEach(() => {
    mockGetPartyPlaylist.mockReset();
    mockGetPublicParty.mockReset();
    mockGetPartyPlaylist.mockResolvedValue(emptyPlaylist);
  });

  it('sets partyDisplayStatus to live after loadPlaylist settles', async () => {
    mockGetPublicParty.mockResolvedValue(buildPublicParty('live'));
    const { usePartyState } = await import('./usePartyState');

    const { result } = renderHook(() => usePartyState({ shortCode: 'abc123' }));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.partyDisplayStatus).toBe('live');
    expect(mockGetPublicParty).toHaveBeenCalledWith('abc123');
  });

  it('sets partyDisplayStatus to scheduled after loadPlaylist settles', async () => {
    mockGetPublicParty.mockResolvedValue(buildPublicParty('scheduled'));
    const { usePartyState } = await import('./usePartyState');

    const { result } = renderHook(() => usePartyState({ shortCode: 'xyz789' }));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.partyDisplayStatus).toBe('scheduled');
  });

  it('keeps partyDisplayStatus null when API returns invalid broadcasting', async () => {
    mockGetPublicParty.mockResolvedValue(buildPublicParty('broadcasting'));
    const { usePartyState } = await import('./usePartyState');

    const { result } = renderHook(() => usePartyState({ shortCode: 'bad999' }));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.partyDisplayStatus).toBeNull();
  });
});
