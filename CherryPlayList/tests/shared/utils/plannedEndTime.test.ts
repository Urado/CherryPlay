import type { Track } from '@core/types/track';
import { describe, expect, it, jest } from '@jest/globals';

import { calculatePlannedEndMarker } from '../../../src/shared/utils/dividerUtils';
import type { DividerCalculationContext } from '../../../src/shared/utils/dividerUtils';

const makeTrack = (duration: number): Track => ({
  id: 'track',
  name: 'track',
  path: '/track.mp3',
  duration,
});

const makeContext = (track: Track): DividerCalculationContext => ({
  tracks: [track],
  activeTrackId: track.id,
  currentTrackPosition: undefined,
  mode: 'session',
  hourDividerInterval: 3600,
  isTrackDisabled: () => false,
  isTrackPlayed: () => false,
  calculateTrackDurationWithPause: (item) => item.duration ?? 0,
});

describe('planned end time of day', () => {
  it('uses the next 01:00 occurrence when the saved setting is two days old', () => {
    const savedSetting = new Date(2026, 3, 26, 1, 0, 0, 0).getTime();
    const now = new Date(2026, 3, 28, 1, 30, 0, 0);
    const expected = new Date(2026, 3, 29, 1, 0, 0, 0).getTime();
    const track = makeTrack(26 * 60 * 60);
    jest.useFakeTimers();
    jest.setSystemTime(now);

    let marker: ReturnType<typeof calculatePlannedEndMarker> = null;
    try {
      marker = calculatePlannedEndMarker(makeContext(track), savedSetting);
    } finally {
      jest.useRealTimers();
    }
    expect(marker).toEqual({ trackId: null, time: expected });
  });

  it('moves the planned end to the next day when it crosses midnight', () => {
    const savedSetting = new Date(2026, 3, 26, 1, 0, 0, 0).getTime();
    const now = new Date(2026, 3, 28, 23, 30, 0, 0);
    const expected = new Date(2026, 3, 29, 1, 0, 0, 0).getTime();
    const track = makeTrack(26 * 60 * 60);
    jest.useFakeTimers();
    jest.setSystemTime(now);

    let marker: ReturnType<typeof calculatePlannedEndMarker> = null;
    try {
      marker = calculatePlannedEndMarker(makeContext(track), savedSetting);
    } finally {
      jest.useRealTimers();
    }
    expect(marker).toEqual({ trackId: null, time: expected });
  });
});
