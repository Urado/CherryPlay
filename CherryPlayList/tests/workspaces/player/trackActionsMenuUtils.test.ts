import { ProjectGroup, ProjectItem } from '../../../src/core/types/project';
import { Track } from '../../../src/core/types/track';
import {
  getActionsTargetTrackId,
  isTrackActionsMenuDisabled,
} from '../../../src/workspaces/player/utils/trackActionsMenuUtils';

const createTrack = (id: string): Track => ({
  id,
  type: 'track',
  path: `/${id}.mp3`,
  name: id,
});

const getAllTracksInOrder = (items: ProjectItem[]): Track[] => {
  const out: Track[] = [];
  for (const item of items) {
    if ('items' in item) {
      out.push(...getAllTracksInOrder(item.items));
    } else {
      out.push(item);
    }
  }
  return out;
};

describe('trackActionsMenuUtils', () => {
  const jumpToTrack = jest.fn().mockResolvedValue(undefined);

  describe('isTrackActionsMenuDisabled', () => {
    it('disables when jumpToTrack is missing (preparation mode)', () => {
      expect(isTrackActionsMenuDisabled(undefined, 't1', 't2')).toBe(true);
    });

    it('disables when the target track id is missing (empty group)', () => {
      expect(isTrackActionsMenuDisabled(jumpToTrack, undefined, 't2')).toBe(true);
    });

    it('disables when the first target track is already the active player track', () => {
      expect(isTrackActionsMenuDisabled(jumpToTrack, 't1', 't1')).toBe(true);
    });

    it('enables when jump is available and the target is not the active track', () => {
      expect(isTrackActionsMenuDisabled(jumpToTrack, 't1', 't2')).toBe(false);
    });
  });

  describe('getActionsTargetTrackId', () => {
    it('returns undefined for an empty group', () => {
      const emptyGroup: ProjectGroup = { id: 'g-empty', name: 'Empty', items: [] };
      expect(getActionsTargetTrackId(emptyGroup, getAllTracksInOrder)).toBeUndefined();
    });

    it('returns the first leaf track id for a nested group', () => {
      const nested: ProjectGroup = {
        id: 'outer',
        name: 'Outer',
        items: [
          {
            id: 'inner',
            name: 'Inner',
            items: [createTrack('leaf-1'), createTrack('leaf-2')],
          },
        ],
      };
      expect(getActionsTargetTrackId(nested, getAllTracksInOrder)).toBe('leaf-1');
    });

    it('returns the track id for a track item', () => {
      expect(getActionsTargetTrackId(createTrack('solo'), getAllTracksInOrder)).toBe('solo');
    });
  });
});
