import { act } from '@testing-library/react';

import { useGlobalHistoryStore } from '../../src/shared/stores/globalHistoryStore';
import {
  ensureProjectStore,
  initializeGlobalHistory,
  removeProjectStore,
} from '../../src/shared/stores/projectStoreFactory';

const WORKSPACE_ID = 'playlist-test-workspace';

const resetStores = () => {
  removeProjectStore(WORKSPACE_ID);
  const store = ensureProjectStore({
    workspaceId: WORKSPACE_ID,
    initialName: 'New Playlist',
    persist: false,
  });
  store.setState({
    ...store.getState(),
    name: 'New Playlist',
    items: [],
    selectedItemIds: new Set<string>(),
    _skipHistory: false,
  });
  useGlobalHistoryStore.getState().clearHistory();
  return store;
};

const createDraft = (label: string) => ({
  path: `/music/${label}.mp3`,
  name: `${label}.mp3`,
  duration: undefined,
});

const addSampleTracks = (...labels: string[]) => {
  const store = ensureProjectStore({ workspaceId: WORKSPACE_ID });
  act(() => {
    store.getState().addItems(labels.map(createDraft));
  });
  return store.getState().items.map((track) => track.id);
};

beforeEach(() => {
  initializeGlobalHistory();
  resetStores();
});

afterEach(() => {
  removeProjectStore(WORKSPACE_ID);
  useGlobalHistoryStore.getState().clearHistory();
});

describe('projectStore (playlist workspace)', () => {
  it('adds tracks and assigns ids', () => {
    const store = ensureProjectStore({ workspaceId: WORKSPACE_ID });
    act(() => {
      store.getState().addItems([createDraft('one'), createDraft('two')]);
    });

    const state = store.getState();
    expect(state.items).toHaveLength(2);
    expect(state.items[0].id).toBeDefined();
  });

  it('inserts tracks at specific index', () => {
    const store = ensureProjectStore({ workspaceId: WORKSPACE_ID });
    const [idA, idB] = addSampleTracks('a', 'b');

    act(() => {
      store.getState().addItems([createDraft('mid')], 1);
    });

    const state = store.getState();
    expect(state.items.map((t) => t.name)).toEqual(['a.mp3', 'mid.mp3', 'b.mp3']);
    expect(state.items[0].id).toBe(idA);
    expect(state.items[2].id).toBe(idB);
  });

  it('moves single track', () => {
    const store = ensureProjectStore({ workspaceId: WORKSPACE_ID });
    addSampleTracks('first', 'second', 'third');

    act(() => {
      store.getState().moveItem(0, 2);
    });

    expect(store.getState().items.map((t) => t.name)).toEqual([
      'second.mp3',
      'third.mp3',
      'first.mp3',
    ]);
  });

  it('moves selected group preserving order', () => {
    const store = ensureProjectStore({ workspaceId: WORKSPACE_ID });
    const [id1, id2] = addSampleTracks('one', 'two', 'three', 'four');
    act(() => {
      store.getState().toggleItemSelection(id1);
      store.getState().toggleItemSelection(id2);
      store.getState().moveSelectedItems(3);
    });

    expect(store.getState().items.map((t) => t.name)).toEqual([
      'three.mp3',
      'four.mp3',
      'one.mp3',
      'two.mp3',
    ]);
  });

  it('handles selection helpers', () => {
    const store = ensureProjectStore({ workspaceId: WORKSPACE_ID });
    const ids = addSampleTracks('a', 'b', 'c');

    act(() => {
      store.getState().toggleItemSelection(ids[0]);
      store.getState().selectRange(ids[0], ids[2]);
    });
    const state = store.getState();
    expect(state.selectedItemIds.has(ids[2])).toBeTruthy();
    expect(state.selectedItemIds.size).toBe(3);

    act(() => store.getState().deselectAll());
    expect(store.getState().selectedItemIds.size).toBe(0);
  });

  it('removes selected tracks', () => {
    const store = ensureProjectStore({ workspaceId: WORKSPACE_ID });
    const ids = addSampleTracks('a', 'b', 'c');

    act(() => {
      store.getState().toggleItemSelection(ids[1]);
      store.getState().removeSelectedItems();
    });

    expect(store.getState().items.map((t) => t.name)).toEqual(['a.mp3', 'c.mp3']);
  });

  it('updates track duration', () => {
    const store = ensureProjectStore({ workspaceId: WORKSPACE_ID });
    const [id] = addSampleTracks('duration');

    act(() => {
      store.getState().updateTrackDuration(id, 120);
    });

    expect(store.getState().items[0].duration).toBe(120);
  });

  it('supports undo/redo for add and move operations', () => {
    const store = ensureProjectStore({ workspaceId: WORKSPACE_ID });
    act(() => {
      store.getState().addItems([createDraft('a'), createDraft('b')]);
    });

    act(() => {
      store.getState().moveItem(0, 1);
    });
    const orderAfterMove = store.getState().items.map((t) => t.name);

    act(() => {
      useGlobalHistoryStore.getState().undo();
    });
    expect(store.getState().items.map((t) => t.name)).toEqual(['a.mp3', 'b.mp3']);

    act(() => {
      useGlobalHistoryStore.getState().redo();
    });
    expect(store.getState().items.map((t) => t.name)).toEqual(orderAfterMove);
  });
});
