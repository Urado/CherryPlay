const listeners: Array<() => void> = [];
const mockUpdatePartyPlaylist = jest.fn();
let projectState: {
  items: Array<{ id: string }>;
  meta: { linkedParty: { id: string } | null };
} = { items: [], meta: { linkedParty: null } };

jest.mock('../../../src/shared/services/partyService', () => ({
  partyService: { updatePartyPlaylist: (...args: unknown[]) => mockUpdatePartyPlaylist(...args) },
}));

jest.mock('../../../src/shared/stores/projectStore', () => ({
  useProjectStore: {
    getState: () => projectState,
    subscribe: (listener: () => void) => {
      listeners.push(listener);
      listener();
      return () => {
        const index = listeners.indexOf(listener);
        if (index >= 0) listeners.splice(index, 1);
      };
    },
  },
}));

jest.mock('../../../src/shared/stores/aimpStore', () => ({
  useAimpStore: { getState: () => ({ bridgeState: { liveStreamStarted: false } }), subscribe: () => () => undefined },
}));

import { subscribePartyPlaylistSync } from '../../../src/shared/streaming/partyPlaylistSync';

describe('subscribePartyPlaylistSync when creating a project', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    listeners.length = 0;
    projectState = { items: [{ id: 'existing' }], meta: { linkedParty: { id: 'party-1' } } };
  });

  it('does not replace the linked party playlist after the project is cleared', async () => {
    const unsubscribe = subscribePartyPlaylistSync(
      'party-1',
      () => ({ items: [], totalDuration: 0, totalTracks: 0 }),
      jest.fn(),
    );

    projectState = { items: [], meta: { linkedParty: null } };
    listeners[0]();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockUpdatePartyPlaylist).not.toHaveBeenCalled();
    unsubscribe();
  });
});
