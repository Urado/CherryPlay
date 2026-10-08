const listeners: Array<() => void> = [];
const mockUpdatePartyPlaylist = jest.fn();
let projectState: { items: Array<{ id: string }> } = { items: [] };

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

const makePayload = (id: string) => ({
  items: [{ id, type: 'track' as const, name: 'Repeat', displayOrder: 0, level: 0 }],
  totalTracks: 1,
  totalDuration: 180,
});

describe('subscribePartyPlaylistSync coalescing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    listeners.length = 0;
    projectState = { items: [] };
  });

  it('serializes rapid updates and publishes the final duplicate-name snapshot', async () => {
    let resolveFirst: (() => void) | undefined;
    mockUpdatePartyPlaylist
      .mockImplementationOnce(() => new Promise<void>((resolve) => { resolveFirst = resolve; }))
      .mockResolvedValue(undefined);
    let latest = makePayload('first');
    const onAfterSync = jest.fn();
    const onSynced = jest.fn();
    const unsubscribe = subscribePartyPlaylistSync('party', () => latest, onAfterSync, undefined, onSynced);

    listeners[0]();
    latest = { ...makePayload('second'), items: [...makePayload('first').items, ...makePayload('second').items] };
    listeners[0]();
    latest = { ...makePayload('third'), items: [...makePayload('first').items, ...makePayload('second').items, ...makePayload('third').items] };
    listeners[0]();

    expect(mockUpdatePartyPlaylist).toHaveBeenCalledTimes(1);
    resolveFirst?.();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockUpdatePartyPlaylist).toHaveBeenCalledTimes(2);
    expect(mockUpdatePartyPlaylist.mock.calls[1][1].items.map((item: { name: string }) => item.name)).toEqual([
      'Repeat', 'Repeat', 'Repeat',
    ]);
    expect(onAfterSync).toHaveBeenCalledTimes(2);
    expect(onSynced).toHaveBeenCalledTimes(2);
    unsubscribe();
  });
});
