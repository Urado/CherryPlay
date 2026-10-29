type Track = import('../../../src/core/types/track').Track;
type LookaheadModule = {
  getSessionLookaheadTracks: (
    tracks: Track[],
    currentTrackId: string,
    isTrackActive: (trackId: string) => boolean,
    limit?: number,
  ) => Track[];
};

const loadLookaheadModule = (): LookaheadModule | null => {
  try {
    return jest.requireActual<LookaheadModule>(
      '../../../src/shared/utils/sessionLoudnessLookahead',
    );
  } catch {
    return null;
  }
};

const tracks: Track[] = Array.from({ length: 8 }, (_, index) => ({
  id: `track-${index + 1}`,
  path: `D:/Music/track-${index + 1}.flac`,
  name: `Track ${index + 1}`,
}));

describe('session loudness lookahead acceptance', () => {
  it('selects at most the next three active tracks in playlist order', () => {
    const selector = loadLookaheadModule()?.getSessionLookaheadTracks;
    expect(selector).toEqual(expect.any(Function));
    if (!selector) return;

    expect(
      selector(tracks, 'track-3', (trackId) => !['track-5', 'track-7'].includes(trackId)),
    ).toEqual([tracks[3], tracks[5], tracks[7]]);
  });

  it('never wraps to the beginning and returns only the remaining tail', () => {
    const selector = loadLookaheadModule()?.getSessionLookaheadTracks;
    expect(selector).toEqual(expect.any(Function));
    if (!selector) return;

    expect(selector(tracks, 'track-7', () => true)).toEqual([tracks[7]]);
    expect(selector(tracks, 'missing-track', () => true)).toEqual([]);
  });
});
