import type { Track } from '@core/types/track';
import { getDuplicateTrackIdsByPathAndFilename } from '@shared/utils/duplicateUtils';

describe('getDuplicateTrackIdsByPathAndFilename', () => {
  it('ignores tracks without paths', () => {
    const tracks = [
      { id: 'missing-a', name: 'Missing A', path: undefined },
      { id: 'missing-b', name: 'Missing B', path: undefined },
    ] as unknown as Track[];

    expect(getDuplicateTrackIdsByPathAndFilename(tracks)).toEqual(new Set());
  });

  it('marks tracks with matching filenames when their paths differ', () => {
    const tracks: Track[] = [
      { id: 'first', name: 'First', path: 'C:\\music\\track.mp3' },
      { id: 'second', name: 'Second', path: 'D:\\music\\track.mp3' },
    ];

    expect(getDuplicateTrackIdsByPathAndFilename(tracks)).toEqual(new Set(['first', 'second']));
  });
});
