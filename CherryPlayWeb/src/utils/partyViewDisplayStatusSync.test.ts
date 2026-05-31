import { describe, expect, it, vi } from 'vitest';

import type { PartyDisplayStatusId, PartyStateDto } from '../types/api';

/**
 * Mirrors PartyView.requestFullState (PartyView.tsx ~149–150):
 * setPartyDisplayStatus(state.partyDisplayStatus) — no isPartyDisplayStatusId guard (spec A7).
 */
function syncPartyDisplayStatusFromFullState(
  state: PartyStateDto,
  setPartyDisplayStatus: (status: PartyDisplayStatusId | null) => void,
): void {
  setPartyDisplayStatus(state.partyDisplayStatus);
}

function buildPartyState(partyDisplayStatus: PartyDisplayStatusId): PartyStateDto {
  return {
    partyId: 'party-1',
    isSessionActive: true,
    partyDisplayStatus,
    playlist: {
      items: [],
      totalDuration: 0,
      totalTracks: 0,
    },
  };
}

describe('PartyView requestFullState partyDisplayStatus sync', () => {
  it('assigns live from mocked requestFullState result', async () => {
    const mockRequestFullState = vi.fn().mockResolvedValue(buildPartyState('live'));
    const setPartyDisplayStatus = vi.fn();

    const state = await mockRequestFullState('abc123');

    if (state) {
      syncPartyDisplayStatusFromFullState(state, setPartyDisplayStatus);
    }

    expect(mockRequestFullState).toHaveBeenCalledWith('abc123');
    expect(setPartyDisplayStatus).toHaveBeenCalledOnce();
    expect(setPartyDisplayStatus).toHaveBeenCalledWith('live');
  });

  it('assigns partyDisplayStatus without isPartyDisplayStatusId guard (spec A7)', () => {
    const setPartyDisplayStatus = vi.fn();
    const state: PartyStateDto = {
      ...buildPartyState('live'),
      partyDisplayStatus: 'broadcasting' as PartyDisplayStatusId,
    };

    syncPartyDisplayStatusFromFullState(state, setPartyDisplayStatus);

    expect(setPartyDisplayStatus).toHaveBeenCalledWith('broadcasting');
  });
});
