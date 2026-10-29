import { useGlobalHistoryStore } from '../../../src/shared/stores/globalHistoryStore';
import {
  ensureProjectStore,
  initializeGlobalHistory,
  removeProjectStore,
} from '../../../src/shared/stores/projectStoreFactory';

describe('project store factory addItemsToGroup', () => {
  const workspaceId = 'group-insertion-test' as never;
  const initialItems = [
    {
      id: 'outer-group',
      name: 'Outer group',
      items: [
        {
          id: 'inner-group',
          name: 'Inner group',
          items: [{ id: 'existing-track', path: 'existing.mp3', name: 'Existing' }],
        },
      ],
    },
  ];

  beforeEach(() => {
    initializeGlobalHistory();
    useGlobalHistoryStore.getState().clearHistory();
    ensureProjectStore({ workspaceId, initialName: 'Collection', supportsGroups: true })
      .getState()
      .loadData({ name: 'Collection', items: initialItems });
  });

  afterEach(() => {
    removeProjectStore(workspaceId);
    useGlobalHistoryStore.getState().clearHistory();
  });

  it('inserts folder tracks into a nested collection group and supports undo and redo', () => {
    const store = ensureProjectStore({ workspaceId, supportsGroups: true });
    const addedTracks = store.getState().addItemsToGroup(
      'inner-group',
      [
        { path: 'first.mp3', name: 'First' },
        { path: 'second.mp3', name: 'Second' },
      ],
      1,
    );
    const getInnerTracks = () => {
      const outerGroup = store.getState().items[0];
      if (!('items' in outerGroup)) return [];
      const innerGroup = outerGroup.items[0];
      return 'items' in innerGroup ? innerGroup.items : [];
    };

    expect(getInnerTracks().map(({ name }) => name)).toEqual(['Existing', 'First', 'Second']);
    expect(getInnerTracks().slice(1)).toEqual(addedTracks);

    expect(useGlobalHistoryStore.getState().undo()).toBe(true);
    expect(getInnerTracks().map(({ name }) => name)).toEqual(['Existing']);

    expect(useGlobalHistoryStore.getState().redo()).toBe(true);
    expect(getInnerTracks().map(({ name }) => name)).toEqual(['Existing', 'First', 'Second']);
  });
});
