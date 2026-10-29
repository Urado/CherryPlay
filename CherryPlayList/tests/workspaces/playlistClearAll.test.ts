import { act } from '@testing-library/react';

import { useGlobalHistoryStore } from '../../src/shared/stores/globalHistoryStore';
import {
  initializeProjectStoreHistory,
  useProjectStore,
} from '../../src/shared/stores/projectStore';
import { initializeGlobalHistory } from '../../src/shared/stores/projectStoreFactory';

describe('playlist clear all', () => {
  beforeEach(() => {
    initializeProjectStoreHistory();
    initializeGlobalHistory();
    useProjectStore.getState().newProject();
    const state = useProjectStore.getState();
    useProjectStore.setState({
      name: 'Party playlist',
      items: [
        { id: 'track-one', path: 'D:/music/one.mp3', name: 'One', duration: 120 },
        { id: 'track-two', path: 'D:/music/two.mp3', name: 'Two', duration: 180 },
      ],
      meta: { ...state.meta, linkedParty: { id: 'party-id', shortCode: 'party-code' } },
      sessionState: { ...state.sessionState, mode: 'session', sessionStartTime: 100 },
    });
    useGlobalHistoryStore.getState().clearHistory();
  });

  afterEach(() => {
    useProjectStore.getState().newProject();
    useGlobalHistoryStore.getState().clearHistory();
  });

  it('removes all playlist items without resetting the party and can be undone', () => {
    const party = useProjectStore.getState().meta.linkedParty;
    useGlobalHistoryStore.getState().clearHistory();

    act(() => {
      useProjectStore.getState().selectAll();
      useProjectStore.getState().removeSelectedItems();
    });

    expect(useProjectStore.getState().items).toEqual([]);
    expect(useProjectStore.getState().meta.linkedParty).toEqual(party);
    expect(useProjectStore.getState().sessionState.mode).toBe('session');
    expect(useGlobalHistoryStore.getState().canUndo()).toBe(true);

    act(() => {
      useGlobalHistoryStore.getState().undo();
    });

    expect(useProjectStore.getState().items.map((item) => item.name)).toEqual(['One', 'Two']);
    expect(useProjectStore.getState().meta.linkedParty).toEqual(party);
    expect(useProjectStore.getState().sessionState.mode).toBe('session');
  });
});
