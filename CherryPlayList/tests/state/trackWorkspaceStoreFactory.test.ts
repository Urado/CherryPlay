import {
  ensureTrackWorkspaceStore,
  getTrackWorkspaceStore,
  removeTrackWorkspaceStore,
} from '../../src/state/trackWorkspaceStoreFactory';

const WORKSPACE_ID = 'factory-test-workspace';

const createDraft = (label: string) => ({
  path: `/music/${label}.mp3`,
  name: `${label}.mp3`,
  duration: 120,
});

describe('trackWorkspaceStoreFactory', () => {
  afterEach(() => {
    removeTrackWorkspaceStore(WORKSPACE_ID);
  });

  it('returns the same store instance for repeated ensure calls', () => {
    const storeA = ensureTrackWorkspaceStore({ workspaceId: WORKSPACE_ID });
    const storeB = ensureTrackWorkspaceStore({ workspaceId: WORKSPACE_ID });

    expect(storeA).toBe(storeB);
  });

  it('respects maxTracks limit across add operations', () => {
    const store = ensureTrackWorkspaceStore({ workspaceId: WORKSPACE_ID, maxTracks: 2 });
    const { addTracks } = store.getState();

    addTracks([createDraft('one'), createDraft('two'), createDraft('three')]);

    const tracks = store.getState().tracks;
    expect(tracks).toHaveLength(2);
    expect(tracks.map((t) => t.name)).toEqual(['one.mp3', 'two.mp3']);
  });

  it('removes store from registry via removeTrackWorkspaceStore', () => {
    const originalStore = ensureTrackWorkspaceStore({ workspaceId: WORKSPACE_ID });
    expect(getTrackWorkspaceStore(WORKSPACE_ID)).toBe(originalStore);

    removeTrackWorkspaceStore(WORKSPACE_ID);
    expect(getTrackWorkspaceStore(WORKSPACE_ID)).toBeUndefined();

    const recreatedStore = ensureTrackWorkspaceStore({ workspaceId: WORKSPACE_ID });
    expect(recreatedStore).not.toBe(originalStore);
  });
});
