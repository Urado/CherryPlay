import { act } from '@testing-library/react';

import { useHistoryStore } from '../../src/state/historyStore';
import { usePlaylistStore } from '../../src/state/playlistStore';

const resetStores = () => {
  usePlaylistStore.setState({
    name: 'New Playlist',
    tracks: [],
    selectedTrackIds: new Set<string>(),
    _skipHistory: false,
  });
  useHistoryStore.setState({
    history: [],
    historyIndex: -1,
    maxDepth: 50,
  });
};

const createDraft = (label: string) => ({
  path: `/music/${label}.mp3`,
  name: `${label}.mp3`,
  duration: undefined,
});

const addSampleTracks = (...labels: string[]) => {
  const store = usePlaylistStore.getState();
  act(() => {
    store.addTracks(labels.map(createDraft));
  });
  return usePlaylistStore.getState().tracks.map((track) => track.id);
};

beforeEach(() => {
  resetStores();
});

describe('playlistStore', () => {
  it('adds tracks and assigns ids', () => {
    const store = usePlaylistStore.getState();
    act(() => {
      store.addTracks([createDraft('one'), createDraft('two')]);
    });

    const state = usePlaylistStore.getState();
    expect(state.tracks).toHaveLength(2);
    expect(state.tracks[0].id).toBeDefined();
  });

  it('inserts tracks at specific index', () => {
    const store = usePlaylistStore.getState();
    const [idA, idB] = addSampleTracks('a', 'b');

    act(() => {
      store.addTracksAt([createDraft('mid')], 1);
    });

    const state = usePlaylistStore.getState();
    expect(state.tracks.map((t) => t.name)).toEqual(['a.mp3', 'mid.mp3', 'b.mp3']);
    expect(state.tracks[0].id).toBe(idA);
    expect(state.tracks[2].id).toBe(idB);
  });

  it('moves single track', () => {
    const store = usePlaylistStore.getState();
    addSampleTracks('first', 'second', 'third');

    act(() => {
      store.moveTrack(0, 2);
    });

    expect(usePlaylistStore.getState().tracks.map((t) => t.name)).toEqual([
      'second.mp3',
      'third.mp3',
      'first.mp3',
    ]);
  });

  it('moves selected group preserving order', () => {
    const store = usePlaylistStore.getState();
    const [id1, id2] = addSampleTracks('one', 'two', 'three', 'four');
    act(() => {
      store.toggleTrackSelection(id1);
      store.toggleTrackSelection(id2);
      store.moveSelectedTracks(3);
    });

    expect(usePlaylistStore.getState().tracks.map((t) => t.name)).toEqual([
      'three.mp3',
      'four.mp3',
      'one.mp3',
      'two.mp3',
    ]);
  });

  it('handles selection helpers', () => {
    const store = usePlaylistStore.getState();
    const ids = addSampleTracks('a', 'b', 'c');

    act(() => {
      store.toggleTrackSelection(ids[0]);
      store.selectRange(ids[0], ids[2]);
    });
    const state = usePlaylistStore.getState();
    expect(state.selectedTrackIds.has(ids[2])).toBeTruthy();
    expect(state.selectedTrackIds.size).toBe(3);

    act(() => store.deselectAll());
    expect(usePlaylistStore.getState().selectedTrackIds.size).toBe(0);
  });

  it('removes selected tracks', () => {
    const store = usePlaylistStore.getState();
    const ids = addSampleTracks('a', 'b', 'c');

    act(() => {
      store.toggleTrackSelection(ids[1]);
      store.removeSelectedTracks();
    });

    expect(usePlaylistStore.getState().tracks.map((t) => t.name)).toEqual(['a.mp3', 'c.mp3']);
  });

  it('updates track duration', () => {
    const store = usePlaylistStore.getState();
    const [id] = addSampleTracks('duration');

    act(() => {
      store.updateTrackDuration(id, 120);
    });

    expect(usePlaylistStore.getState().tracks[0].duration).toBe(120);
  });

  it('supports undo/redo for add and move operations', () => {
    const store = usePlaylistStore.getState();
    act(() => {
      store.addTracks([createDraft('a'), createDraft('b')]);
    });

    act(() => {
      store.moveTrack(0, 1);
    });
    const orderAfterMove = usePlaylistStore.getState().tracks.map((t) => t.name);

    act(() => {
      store.undo();
    });
    expect(usePlaylistStore.getState().tracks.map((t) => t.name)).toEqual(['a.mp3', 'b.mp3']);

    act(() => {
      store.redo();
    });
    expect(usePlaylistStore.getState().tracks.map((t) => t.name)).toEqual(orderAfterMove);
  });
});
