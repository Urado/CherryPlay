import { createTrackDraft, createTrackDrafts } from '../../src/utils/trackFactory';

describe('trackFactory', () => {
  it('creates draft with filename extracted from path', () => {
    const draft = createTrackDraft('C:/Music/My Song.mp3');
    expect(draft).toEqual({
      path: 'C:/Music/My Song.mp3',
      name: 'My Song.mp3',
      duration: undefined,
    });
  });

  it('creates multiple drafts preserving order', () => {
    const drafts = createTrackDrafts(['/one.mp3', '/two.mp3']);
    expect(drafts).toHaveLength(2);
    expect(drafts[0].name).toBe('one.mp3');
    expect(drafts[1].name).toBe('two.mp3');
  });
});
