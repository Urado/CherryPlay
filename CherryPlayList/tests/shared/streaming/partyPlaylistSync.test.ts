const mockUpdatePartyPlaylist = jest.fn();
const listeners: Array<() => void> = [];

jest.mock('../../../src/shared/services/partyService', () => ({
  partyService: {
    updatePartyPlaylist: (...args: unknown[]) => mockUpdatePartyPlaylist(...args),
  },
}));

jest.mock('../../../src/shared/stores/projectStore', () => ({
  useProjectStore: Object.assign(() => ({ items: [] }), {
    getState: () => ({ items: [{ id: 't1' }] }),
    subscribe: (listener: () => void) => {
      listeners.push(listener);
      listener();
      return () => {
        const index = listeners.indexOf(listener);
        if (index >= 0) {
          listeners.splice(index, 1);
        }
      };
    },
    setState: () => {
      for (const listener of [...listeners]) {
        listener();
      }
    },
  }),
}));

jest.mock('../../../src/shared/stores/aimpStore', () => ({
  useAimpStore: {
    getState: () => ({ bridgeState: { liveStreamStarted: false } }),
    subscribe: () => () => undefined,
  },
}));

import { useProjectStore } from '../../../src/shared/stores/projectStore';
import { subscribePartyPlaylistSync } from '../../../src/shared/streaming/partyPlaylistSync';

describe('subscribePartyPlaylistSync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    listeners.length = 0;
  });

  it('calls onSyncError and skips onAfterSync when live playlist PUT fails', async () => {
    const onSyncError = jest.fn();
    const onAfterSync = jest.fn();
    mockUpdatePartyPlaylist.mockRejectedValue(new Error('put failed'));

    const unsubscribe = subscribePartyPlaylistSync(
      'party-1',
      () => ({ items: [], totalDuration: 0, totalTracks: 0 }),
      onAfterSync,
      onSyncError,
    );

    useProjectStore.setState({} as never);

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockUpdatePartyPlaylist).toHaveBeenCalled();
    expect(onSyncError).toHaveBeenCalledWith(expect.any(Error));
    expect(onAfterSync).not.toHaveBeenCalled();

    unsubscribe();
  });

  it('calls onAfterSync only after successful playlist PUT', async () => {
    const onSyncError = jest.fn();
    const onAfterSync = jest.fn();
    mockUpdatePartyPlaylist.mockResolvedValue(undefined);

    const unsubscribe = subscribePartyPlaylistSync(
      'party-1',
      () => ({ items: [], totalDuration: 0, totalTracks: 0 }),
      onAfterSync,
      onSyncError,
    );

    useProjectStore.setState({} as never);

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockUpdatePartyPlaylist).toHaveBeenCalled();
    expect(onAfterSync).toHaveBeenCalledTimes(1);
    expect(onSyncError).not.toHaveBeenCalled();

    unsubscribe();
  });
});
