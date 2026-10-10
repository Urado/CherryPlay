import type { ProjectItem, ProjectTrackSettings } from '@core/types/project';

import {
  calculateProgramTimelineDuration,
  collectProgramTracksInOrder,
  createEmptyTrack,
  filterProjectItemsForSite,
  resolveGuestSitePlaybackPresentation,
} from '../../src/shared/utils/programTrackUtils';

describe('programTrackUtils', () => {
  it('filters hidden tracks from site publication tree', () => {
    const empty = createEmptyTrack({ id: 'e1', name: 'Photo', duration: 120 });
    const visibleTrack = {
      id: 't1',
      path: '/music/a.mp3',
      name: 'Track A',
      duration: 180,
    };
    const items: ProjectItem[] = [visibleTrack, empty];
    const trackSettings = new Map<string, ProjectTrackSettings>([['e1', { hiddenFromSite: true }]]);

    const filtered = filterProjectItemsForSite(items, trackSettings);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('t1');
  });

  it('includes pauseAndNext intervals and empty track durations in timeline total', () => {
    const items: ProjectItem[] = [
      { id: 't1', path: '/a.mp3', name: 'A', duration: 100 },
      createEmptyTrack({ id: 'e1', name: 'Break', duration: 50 }),
    ];
    const ordered = collectProgramTracksInOrder(items);
    const total = calculateProgramTimelineDuration(ordered, {
      isTrackDisabled: () => false,
      getEffectiveTrackSettings: (trackId) =>
        trackId === 't1'
          ? { actionAfterTrack: 'pauseAndNext', pauseBetweenTracks: 10 }
          : { actionAfterTrack: 'next', pauseBetweenTracks: 0 },
    });
    expect(total).toBe(160);
  });

  it('shows previous visible track paused on site while hidden track plays', () => {
    const items: ProjectItem[] = [
      { id: 't1', path: '/a.mp3', name: 'A', duration: 100 },
      createEmptyTrack({ id: 'e1', name: 'Hidden', duration: 60 }),
    ];
    const trackSettings = new Map<string, ProjectTrackSettings>([['e1', { hiddenFromSite: true }]]);
    const ordered = collectProgramTracksInOrder(items);

    const presentation = resolveGuestSitePlaybackPresentation({
      currentTrackId: 'e1',
      status: 'playing',
      position: 12,
      duration: 60,
      orderedTracks: ordered,
      trackSettings,
    });

    expect(presentation.currentTrackId).toBe('t1');
    expect(presentation.status).toBe('paused');
    expect(presentation.position).toBe(100);
    expect(presentation.duration).toBe(100);
  });
});
