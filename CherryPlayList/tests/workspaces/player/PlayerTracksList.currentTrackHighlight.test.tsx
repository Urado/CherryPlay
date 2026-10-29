import { render, screen } from '@testing-library/react';

jest.mock('react', () => {
  const actualReact = jest.requireActual<typeof import('react')>('react');
  return { ...actualReact, default: actualReact };
});

import { ProjectItem, isProjectTrack } from '../../../src/core/types/project';
import { Track } from '../../../src/core/types/track';
import { flattenItemsForDisplay } from '../../../src/shared/utils/playerItemsUtils';
import { PlayerTracksList } from '../../../src/workspaces/player/components/PlayerTracksList';

describe('PlayerTracksList current track highlight', () => {
  it('clears playback highlighting after stop while preserving manual selection', () => {
    const track: Track = { id: 'track-1', path: 'track.mp3', name: 'Track' };
    const displayItems = flattenItemsForDisplay([track]);
    const noop = () => undefined;
    const props = {
      displayItems,
      zoneId: 'player-zone',
      selectedItemIds: new Set([track.id]),
      activeTrackId: undefined,
      activePlayerTrackId: track.id,
      playerAudioStatus: 'playing' as const,
      playerStatus: 'idle',
      isPreparationMode: true,
      mode: 'preparation' as const,
      showHourDividers: false,
      plannedEndTime: null,
      plannedEndDividerPosition: null,
      calculateDividerMarkers: new Map(),
      playerDrag: {
        draggedItems: null,
        dragOverId: null,
        dragOverIndex: null,
        insertPosition: null,
        handleDragStart: noop,
        handleDragOver: noop,
        handleDrop: noop,
        handleDragOverContainer: noop,
        handleDropOnContainer: noop,
        handleDragEnd: noop,
        handleDragLeave: noop,
      },
      getAllTracksInOrder: (items: ProjectItem[]) => items.filter(isProjectTrack),
      isTrackPlayed: () => false,
      isGroupDisabled: () => false,
      isTrackOrGroupDisabled: () => false,
      getEffectiveTrackSettings: () => ({ actionAfterTrack: 'pause' as const, pauseBetweenTracks: 0 }),
      formatDividerLabel: () => '',
      formatPlannedEndTimelineLabel: () => '',
      queueEndDividerPosition: null,
      formatQueueEndTimelineLabel: () => '',
      showQueueEndDividerAtListBottom: false,
      toggleItemSelection: noop,
      selectRange: noop,
      removeItem: noop,
      setGroupName: noop,
      handleToggleDisabled: noop,
      handleUngroupGroup: noop,
      handleOpenTrackSettings: noop,
      startTrackPlayback: noop,
      pausePlayback: noop,
    };
    const view = render(<PlayerTracksList {...props} />);
    const row = screen.getByRole('button', { name: /Track/ });

    expect(row).toHaveClass('playlist-item--current', 'selected');

    view.rerender(<PlayerTracksList {...props} playerAudioStatus="paused" />);
    expect(row).toHaveClass('playlist-item--current', 'selected');

    view.rerender(<PlayerTracksList {...props} playerAudioStatus="idle" />);
    expect(row).not.toHaveClass('playlist-item--current');
    expect(row).toHaveClass('selected');

    view.rerender(<PlayerTracksList {...props} playerAudioStatus="playing" />);
    expect(row).toHaveClass('playlist-item--current', 'selected');
  });
});
