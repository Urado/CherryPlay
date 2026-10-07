/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen, within } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { PartyPlaylistData, PlayerItem } from '../../types';

import { PlaylistView } from './PlaylistView';

vi.mock('../../core/hooks/useIsTruncated', () => ({
  useIsTruncated: () => false,
}));

const track = (id: string, displayOrder: number, duration?: number): PlayerItem => ({
  id,
  type: 'track',
  name: id,
  displayOrder,
  level: 0,
  duration,
});

const group = (id: string, displayOrder: number, items: PlayerItem[]): PlayerItem => ({
  id,
  type: 'group',
  name: id,
  displayOrder,
  level: 0,
  items,
});

const playlist = (...items: PlayerItem[]): PartyPlaylistData => ({
  items,
  totalDuration: 0,
  totalTracks: 0,
});

const nestedGroups = (depth: number): PlayerItem => {
  let item = track('Track', 0, 60);
  for (let index = depth; index >= 1; index -= 1) {
    item = group(`Group ${index}`, 0, [item]);
  }
  return item;
};

describe('base PlaylistView group display', () => {
  afterEach(() => cleanup());

  it('defaults to three displayed group levels and lifts the hidden ancestor content', () => {
    render(<PlaylistView playlist={playlist(nestedGroups(4))} />);

    expect(screen.queryByText('Group 1')).toBeNull();
    expect(screen.getByText('Group 2')).toBeTruthy();
    expect(screen.getByText('Group 3')).toBeTruthy();
    expect(screen.getByText('Group 4')).toBeTruthy();
    expect(screen.getByText('Track')).toBeTruthy();
  });

  it.each([
    [0, []],
    [3, ['Group 2', 'Group 3', 'Group 4']],
    [10, ['Group 1', 'Group 2', 'Group 3', 'Group 4']],
  ])('applies configured depth %i', (depth, visibleGroupNames) => {
    render(<PlaylistView playlist={playlist(nestedGroups(4))} groupDisplayDepth={depth} />);

    const visibleNames = Array.from(
      document.querySelectorAll(
        '.party-playlist-item--group > .party-playlist-item-row .party-playlist-item-name',
      ),
    ).map((node) => node.textContent);
    expect(visibleNames).toEqual(visibleGroupNames);
    for (const name of visibleGroupNames) {
      expect(screen.queryByText(name)).toBeTruthy();
    }
  });

  it('preserves mixed direct-track and nested-group order after flattening', () => {
    const mixed = group('Outer', 0, [
      track('First track', 0),
      group('Inner', 1, [
        track('Second track', 0),
        group('Visible group', 1, [track('Third track', 0)]),
      ]),
    ]);
    render(<PlaylistView playlist={playlist(mixed)} groupDisplayDepth={1} />);

    const itemNames = Array.from(document.querySelectorAll('.party-playlist-item-name')).map(
      (node) => node.textContent,
    );
    expect(itemNames).toEqual(['First track', 'Second track', 'Visible group', 'Third track']);
    const numbers = Array.from(
      document.querySelectorAll('.party-playlist-item--track .party-playlist-item-circle'),
    ).map((node) => node.textContent);
    expect(numbers).toEqual(['1', '2', '3']);
  });

  it('counts enabled tracks, reports played progress, and shows duration only when complete', () => {
    const items = group('Summary', 0, [
      track('Played', 0, 60),
      track('Unknown duration', 1),
      track('Cancelled', 2, 120),
    ]);
    render(
      <PlaylistView
        playlist={playlist(items)}
        playedTrackIds={['Played']}
        disabledTrackIds={['Cancelled']}
      />,
    );

    const groupRow = screen.getByText('Summary').closest('.party-playlist-item');
    expect(groupRow).not.toBeNull();
    expect(within(groupRow as HTMLElement).getByText('1 из 2')).toBeTruthy();
    expect(within(groupRow as HTMLElement).queryByText(/тр\./)).toBeNull();
    expect(groupRow?.querySelector('.party-playlist-group-summary')?.textContent).not.toContain(
      '1:00',
    );
  });

  it('shows the complete duration of enabled tracks only', () => {
    const items = group('Known durations', 0, [
      track('First', 0, 60),
      track('Second', 1, 120),
      track('Cancelled', 2, 300),
    ]);
    render(
      <PlaylistView playlist={playlist(items)} disabledTrackIds={['Cancelled']} />,
    );

    const summary = screen.getByText('Known durations').closest('.party-playlist-item')
      ?.querySelector('.party-playlist-group-summary');
    expect(summary?.textContent).toContain('3:00');
  });

  it('aligns sibling track rows at the same nest level', () => {
    const items = group('June', 0, [track('Track two', 0), track('Track three', 1)]);
    render(
      <PlaylistView playlist={playlist(items)} currentTrackId="Track two" playedTrackIds={[]} />,
    );

    const rows = Array.from(
      document.querySelectorAll('.party-playlist-item--track > .party-playlist-item-row'),
    ) as HTMLElement[];
    expect(rows).toHaveLength(2);
    expect(rows[0]?.style.getPropertyValue('--party-playlist-item-nest')).toBe('1');
    expect(rows[1]?.style.getPropertyValue('--party-playlist-item-nest')).toBe('1');
    expect(getComputedStyle(rows[0]).paddingLeft).toBe(getComputedStyle(rows[1]).paddingLeft);
  });

  it('excludes disabled groups and propagates their state to visible tracks', () => {
    const items = group('Cancelled group', 0, [track('Cancelled child', 0, 60)]);
    render(
      <PlaylistView
        playlist={playlist(items)}
        disabledGroupIds={['Cancelled group']}
        groupDisplayDepth={1}
      />,
    );

    const cancelledTrack = screen.getByText('Cancelled child').closest('.party-playlist-item');
    expect(cancelledTrack?.classList.contains('party-playlist-item--disabled')).toBe(true);
    expect(
      screen.getByText('Cancelled group').closest('.party-playlist-item')?.textContent,
    ).toContain('0 из 0');
  });
});
