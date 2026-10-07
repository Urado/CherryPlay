import {
  applySyncedPlaylistTrackIds,
  clearServerPlaylistTrackIds,
  collectFlattenedTrackIdsFromApiItems,
  useServerPlaylistTrackIdsStore,
} from '../../../src/shared/streaming/serverPlaylistTrackIds';
import type { PlayerItemForApi } from '../../../src/shared/utils/partyUtils';

describe('collectFlattenedTrackIdsFromApiItems', () => {
  it('collects track ids from nested groups and skips group ids', () => {
    const items: PlayerItemForApi[] = [
      {
        id: 't1',
        type: 'track',
        name: 'One',
        displayOrder: 0,
        level: 0,
      },
      {
        id: 'g1',
        type: 'group',
        name: 'Group',
        displayOrder: 1,
        level: 0,
        items: [
          {
            id: 't2',
            type: 'track',
            name: 'Two',
            displayOrder: 0,
            level: 1,
          },
          {
            id: 'g2',
            type: 'group',
            name: 'Nested',
            displayOrder: 1,
            level: 1,
            items: [
              {
                id: 't3',
                type: 'track',
                name: 'Three',
                displayOrder: 0,
                level: 2,
              },
            ],
          },
        ],
      },
    ];

    expect(collectFlattenedTrackIdsFromApiItems(items)).toEqual(['t1', 't2', 't3']);
  });
});

describe('applySyncedPlaylistTrackIds', () => {
  beforeEach(() => {
    clearServerPlaylistTrackIds();
  });

  it('updates the store so newly synced track ids are treated as on-server', () => {
    applySyncedPlaylistTrackIds({
      items: [
        {
          id: 'existing',
          type: 'track',
          name: 'Existing',
          displayOrder: 0,
          level: 0,
        },
        {
          id: 'added-next',
          type: 'track',
          name: 'Added next',
          displayOrder: 1,
          level: 0,
        },
      ],
      totalTracks: 2,
      totalDuration: 0,
    });

    const serverTrackIds = useServerPlaylistTrackIdsStore.getState().serverTrackIds;
    expect(serverTrackIds).not.toBeNull();
    expect(serverTrackIds?.has('existing')).toBe(true);
    expect(serverTrackIds?.has('added-next')).toBe(true);
    expect(serverTrackIds?.has('missing')).toBe(false);
  });

  it('clears the indicator set when the synced playlist has no tracks', () => {
    useServerPlaylistTrackIdsStore.getState().setFromIdList(['old']);
    applySyncedPlaylistTrackIds({
      items: [],
      totalTracks: 0,
      totalDuration: 0,
    });
    expect(useServerPlaylistTrackIdsStore.getState().serverTrackIds).toBeNull();
  });

  it('ignores a late getPartyState id list after a newer applySynced', () => {
    const requestGeneration = useServerPlaylistTrackIdsStore.getState().syncGeneration;

    applySyncedPlaylistTrackIds({
      items: [
        {
          id: 'synced',
          type: 'track',
          name: 'Synced',
          displayOrder: 0,
          level: 0,
        },
      ],
      totalTracks: 1,
      totalDuration: 0,
    });

    useServerPlaylistTrackIdsStore
      .getState()
      .setFromIdList(['stale-only'], requestGeneration);

    const serverTrackIds = useServerPlaylistTrackIdsStore.getState().serverTrackIds;
    expect(serverTrackIds?.has('synced')).toBe(true);
    expect(serverTrackIds?.has('stale-only')).toBe(false);
  });
});
