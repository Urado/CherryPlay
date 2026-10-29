import { useGlobalHistoryStore } from '../../../src/shared/stores/globalHistoryStore';
import {
  initializeProjectStoreHistory,
  useProjectStore,
} from '../../../src/shared/stores/projectStore';
import { initializeGlobalHistory } from '../../../src/shared/stores/projectStoreFactory';

jest.mock('../../../src/shared/services/loudnessService', () => ({
  loudnessService: { scanTracks: jest.fn().mockResolvedValue(undefined) },
}));

describe('project store addItemsToGroup', () => {
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
    initializeProjectStoreHistory();
    initializeGlobalHistory();
    useGlobalHistoryStore.getState().clearHistory();
    useProjectStore.setState({ name: 'Group insertion', items: initialItems });
  });

  afterEach(() => {
    useGlobalHistoryStore.getState().clearHistory();
    useProjectStore.setState({ items: [] });
  });

  it('inserts folder tracks at the requested nested group position and supports undo and redo', () => {
    const addedTracks = useProjectStore.getState().addItemsToGroup(
      'inner-group',
      [
        { path: 'first.mp3', name: 'First' },
        { path: 'second.mp3', name: 'Second' },
      ],
      1,
    );

    const getInnerTracks = () => {
      const outerGroup = useProjectStore.getState().items[0];
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
