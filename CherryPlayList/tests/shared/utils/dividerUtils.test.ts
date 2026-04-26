import { describe, expect, it, jest } from '@jest/globals';

import type { Track } from '@core/types/track';

import {
  calculatePlannedEndMarker,
  calculateProjectedEndTime,
  calculateQueueEndMarker,
  formatTimeFromDuration,
  formatTimeFromTimestamp,
  getPriorityHourDividerKind,
  type DividerCalculationContext,
} from '../../../src/shared/utils/dividerUtils';

function makeTrack(id: string, duration: number): Track {
  return {
    id,
    name: id,
    path: `/t/${id}.mp3`,
    duration,
  } as Track;
}

function baseContext(
  overrides: Partial<DividerCalculationContext> = {},
): DividerCalculationContext {
  return {
    tracks: [],
    activeTrackId: null,
    currentTrackPosition: undefined,
    mode: 'preparation',
    hourDividerInterval: 3600,
    isTrackDisabled: () => false,
    isTrackPlayed: () => false,
    calculateTrackDurationWithPause: (t) => t.duration ?? 0,
    ...overrides,
  };
}

describe('dividerUtils timeline formatting', () => {
  it('formatTimeFromTimestamp uses hh:mm:ss segments', () => {
    const d = new Date(2026, 3, 26, 9, 5, 7);
    expect(formatTimeFromTimestamp(d.getTime())).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  });

  it('formatTimeFromDuration uses hh:mm:ss', () => {
    expect(formatTimeFromDuration(3661)).toBe('01:01:01');
    expect(formatTimeFromDuration(59)).toBe('00:00:59');
  });
});

describe('getPriorityHourDividerKind', () => {
  it('picks planned over queue and interval', () => {
    expect(getPriorityHourDividerKind(true, true, true)).toBe('planned-end');
  });

  it('picks queue-end when no planned', () => {
    expect(getPriorityHourDividerKind(false, true, true)).toBe('queue-end');
  });

  it('picks interval when only interval', () => {
    expect(getPriorityHourDividerKind(false, false, true)).toBe('interval');
  });

  it('returns null when nothing applies', () => {
    expect(getPriorityHourDividerKind(false, false, false)).toBeNull();
  });
});

describe('calculateQueueEndMarker', () => {
  it('preparation: last enabled track and total duration', () => {
    const tracks = [makeTrack('a', 60), makeTrack('b', 120)];
    const marker = calculateQueueEndMarker(
      baseContext({
        mode: 'preparation',
        tracks,
      }),
    );
    expect(marker).not.toBeNull();
    expect(marker!.trackId).toBe('b');
    expect(marker!.preparationDurationSeconds).toBe(180);
    expect(marker!.sessionEndTimestamp).toBeNull();
  });

  it('preparation: skips disabled tracks for anchor and sum', () => {
    const tracks = [makeTrack('a', 60), makeTrack('b', 120)];
    const marker = calculateQueueEndMarker(
      baseContext({
        mode: 'preparation',
        tracks,
        isTrackDisabled: (id) => id === 'b',
      }),
    );
    expect(marker).not.toBeNull();
    expect(marker!.trackId).toBe('a');
    expect(marker!.preparationDurationSeconds).toBe(60);
  });

  it('session: wall-clock end from current track onward', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-26T12:00:00.000Z'));
    const tracks = [makeTrack('a', 100), makeTrack('b', 200)];
    const marker = calculateQueueEndMarker(
      baseContext({
        mode: 'session',
        tracks,
        activeTrackId: 'a',
        isTrackPlayed: () => false,
      }),
    );
    jest.useRealTimers();
    expect(marker).not.toBeNull();
    expect(marker!.trackId).toBe('b');
    expect(marker!.preparationDurationSeconds).toBeNull();
    expect(marker!.sessionEndTimestamp).toBe(new Date('2026-04-26T12:05:00.000Z').getTime());
  });

  it('session: wall-clock end uses remaining time on current track (currentTrackPosition)', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-26T12:00:00.000Z'));
    const tracks = [makeTrack('a', 100), makeTrack('b', 200)];
    const marker = calculateQueueEndMarker(
      baseContext({
        mode: 'session',
        tracks,
        activeTrackId: 'a',
        currentTrackPosition: 30,
        isTrackPlayed: () => false,
      }),
    );
    jest.useRealTimers();
    expect(marker).not.toBeNull();
    expect(marker!.trackId).toBe('b');
    // 70s left on a + 200s on b = 270s
    expect(marker!.sessionEndTimestamp).toBe(new Date('2026-04-26T12:04:30.000Z').getTime());
  });

  it('session: skips played tracks', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-26T12:00:00.000Z'));
    const tracks = [makeTrack('a', 100), makeTrack('b', 200)];
    const marker = calculateQueueEndMarker(
      baseContext({
        mode: 'session',
        tracks,
        activeTrackId: 'a',
        isTrackPlayed: (id) => id === 'a',
      }),
    );
    jest.useRealTimers();
    expect(marker).not.toBeNull();
    expect(marker!.trackId).toBe('b');
    expect(marker!.sessionEndTimestamp).toBe(new Date('2026-04-26T12:03:20.000Z').getTime());
  });
});

describe('calculateProjectedEndTime (session)', () => {
  it('matches queue end: now + sum of remaining track durations (non-zero currentTrackPosition)', () => {
    jest.useFakeTimers();
    const t0 = new Date('2026-04-26T12:00:00.000Z').getTime();
    jest.setSystemTime(t0);
    const tracks = [makeTrack('a', 100), makeTrack('b', 200)];
    const end = calculateProjectedEndTime(
      baseContext({
        mode: 'session',
        tracks,
        activeTrackId: 'a',
        currentTrackPosition: 30,
        isTrackPlayed: () => false,
      }),
    );
    jest.useRealTimers();
    expect(end).toBe(t0 + 270_000);
  });
});

describe('calculatePlannedEndMarker (session: label time matches segment boundary when plan inside track)', () => {
  it('when plan falls inside first unplayed track, time is track end on timeline (like interval dividers)', () => {
    jest.useFakeTimers();
    const t0 = new Date('2026-04-26T12:00:00.000Z').getTime();
    jest.setSystemTime(t0);
    const plannedEndTime = t0 + 30_000;
    const tracks = [makeTrack('a', 100)];
    const m = calculatePlannedEndMarker(
      baseContext({
        mode: 'session',
        tracks,
        activeTrackId: 'a',
        isTrackPlayed: () => false,
      }),
      plannedEndTime,
    );
    jest.useRealTimers();
    expect(m).not.toBeNull();
    expect(m!.time).toBe(t0 + 100_000);
  });

  it('when plan falls in second track, time is that track end; anchor is previous', () => {
    jest.useFakeTimers();
    const t0 = new Date('2026-04-26T12:00:00.000Z').getTime();
    jest.setSystemTime(t0);
    // first track 60s: [t0, t0+60s); second 60s: [t0+60s, t0+120s)
    const plannedEndTime = t0 + 90_000;
    const tracks = [makeTrack('a', 60), makeTrack('b', 60)];
    const m = calculatePlannedEndMarker(
      baseContext({
        mode: 'session',
        tracks,
        activeTrackId: 'a',
        isTrackPlayed: () => false,
      }),
      plannedEndTime,
    );
    jest.useRealTimers();
    expect(m).not.toBeNull();
    expect(m!.trackId).toBe('a');
    expect(m!.time).toBe(t0 + 120_000);
  });

  it('with currentTrackPosition drift, label time is segment end (not raw planned instant)', () => {
    jest.useFakeTimers();
    const t0 = new Date('2026-04-26T12:00:00.000Z').getTime();
    jest.setSystemTime(t0);
    // Track wall span [t0-30, t0+30]; planned 20s from track start = t0 -10s
    const plannedEndTime = t0 - 10_000;
    const tracks = [makeTrack('a', 60)];
    const m = calculatePlannedEndMarker(
      baseContext({
        mode: 'session',
        tracks,
        activeTrackId: 'a',
        currentTrackPosition: 30,
        isTrackPlayed: () => false,
      }),
      plannedEndTime,
    );
    jest.useRealTimers();
    expect(m).not.toBeNull();
    expect(m!.time).toBe(t0 + 30_000);
  });
});
