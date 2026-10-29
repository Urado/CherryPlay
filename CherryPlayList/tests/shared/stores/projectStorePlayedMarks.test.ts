import { useProjectStore } from '../../../src/shared/stores/projectStore';

describe('projectStore played marks', () => {
  beforeEach(() => {
    useProjectStore.getState().resetSession();
  });

  it('unmarkTracksAsPlayed removes ids without affecting others', () => {
    useProjectStore.getState().markTracksAsPlayed(['a', 'b', 'c']);
    useProjectStore.getState().unmarkTracksAsPlayed(['b', 'd']);

    expect(useProjectStore.getState().sessionState.playedTrackIds).toEqual(['a', 'c']);
    expect(useProjectStore.getState().isTrackPlayed('b')).toBe(false);
    expect(useProjectStore.getState().isTrackPlayed('a')).toBe(true);
  });

  it('unmarkTracksAsPlayed is a no-op when none of the ids are marked', () => {
    useProjectStore.getState().markTrackAsPlayed('x');
    useProjectStore.getState().unmarkTracksAsPlayed(['y']);

    expect(useProjectStore.getState().sessionState.playedTrackIds).toEqual(['x']);
  });
});
