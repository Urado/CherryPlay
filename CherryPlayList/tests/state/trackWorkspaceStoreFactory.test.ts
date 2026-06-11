import { useGlobalHistoryStore } from '../../src/shared/stores/globalHistoryStore';
import {
  ensureProjectStore,
  getProjectStore,
  removeProjectStore,
} from '../../src/shared/stores/projectStoreFactory';

const WORKSPACE_ID = 'factory-test-workspace';

const createDraft = (label: string) => ({
  path: `/music/${label}.mp3`,
  name: `${label}.mp3`,
  duration: 120,
});

describe('projectStoreFactory', () => {
  afterEach(() => {
    removeProjectStore(WORKSPACE_ID);
    useGlobalHistoryStore.getState().clearHistory();
  });

  it('returns the same store instance for repeated ensure calls', () => {
    const storeA = ensureProjectStore({ workspaceId: WORKSPACE_ID });
    const storeB = ensureProjectStore({ workspaceId: WORKSPACE_ID });

    expect(storeA).toBe(storeB);
  });

  it('respects maxItems limit across add operations', () => {
    const store = ensureProjectStore({ workspaceId: WORKSPACE_ID, maxItems: 2 });
    const { addItems } = store.getState();

    addItems([createDraft('one'), createDraft('two'), createDraft('three')]);

    const items = store.getState().items;
    expect(items).toHaveLength(2);
    expect(items.map((t) => t.name)).toEqual(['one.mp3', 'two.mp3']);
  });

  it('removes store from registry via removeProjectStore', () => {
    const originalStore = ensureProjectStore({ workspaceId: WORKSPACE_ID });
    expect(getProjectStore(WORKSPACE_ID)).toBe(originalStore);

    removeProjectStore(WORKSPACE_ID);
    expect(getProjectStore(WORKSPACE_ID)).toBeUndefined();

    const recreatedStore = ensureProjectStore({ workspaceId: WORKSPACE_ID });
    expect(recreatedStore).not.toBe(originalStore);
  });
});
