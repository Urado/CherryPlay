const mockAddPlayedTrackNext = jest.fn();
const mockAddPlayedGroupNext = jest.fn();
const mockAddNotification = jest.fn();
const mockClose = jest.fn();
const mockProjectState = {
  sessionState: { mode: 'session', playedTrackIds: ['played'], currentTrackId: 'current' },
  findItemById: (id: string) => {
    if (id === 'current') return { id, path: 'current.mp3' };
    if (id === 'group') {
      return {
        id: 'group',
        name: 'Group',
        items: [
          { id: 'g1', path: 'g1.mp3', name: 'g1' },
          { id: 'g2', path: 'g2.mp3', name: 'g2' },
        ],
      };
    }
    if (id === 'empty-group') return { id: 'empty-group', name: 'Empty', items: [] };
    return null;
  },
  getAllTracksInOrder: (items?: Array<{ id: string; items?: unknown[] }>) => {
    if (!items?.length) return [];
    const collect = (values: Array<{ id: string; path?: string; items?: unknown[] }>): Array<{ id: string; path?: string }> => {
      const out: Array<{ id: string; path?: string }> = [];
      for (const value of values) {
        if (Array.isArray(value.items)) {
          out.push(...collect(value.items as Array<{ id: string; path?: string; items?: unknown[] }>));
        } else {
          out.push(value);
        }
      }
      return out;
    };
    return collect(items);
  },
};
const mockAudioState = { currentTrack: null, play: jest.fn(), loadTrack: jest.fn() };

jest.mock('../../../src/workspaces/player/addPlayedTrackNext', () => ({
  addPlayedTrackNext: (...args: unknown[]) => mockAddPlayedTrackNext(...args) as void,
  addPlayedGroupNext: (...args: unknown[]) => mockAddPlayedGroupNext(...args) as void,
}));

jest.mock('../../../src/shared/stores', () => ({
  useProjectStore: (selector: (state: typeof mockProjectState) => unknown) => selector(mockProjectState),
  usePlayerAudioStore: (selector: (state: typeof mockAudioState) => unknown) => selector(mockAudioState),
  useUIStore: (selector: (state: { addNotification: typeof mockAddNotification }) => unknown) =>
    selector({ addNotification: mockAddNotification }),
}));

import { fireEvent, render, screen } from '@testing-library/react';

import { TrackActionsDropdown } from '../../../src/workspaces/player/TrackActionsDropdown';

describe('TrackActionsDropdown repeat action', () => {
  beforeEach(() => {
    mockAddPlayedTrackNext.mockClear();
    mockAddPlayedGroupNext.mockClear();
    mockAddNotification.mockClear();
    mockClose.mockClear();
    mockProjectState.sessionState.playedTrackIds = ['played'];
    mockProjectState.sessionState.currentTrackId = 'current';
  });

  it('shows the action only for played tracks in a session and uses the session pointer fallback', () => {
    mockAddPlayedTrackNext.mockReturnValue(true);
    mockAudioState.currentTrack = { id: 'stale-audio-track' };
    const { rerender } = render(
      <TrackActionsDropdown trackId="played" anchorRect={new DOMRect()} onClose={mockClose} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Добавить следующим' }));

    expect(mockAddPlayedTrackNext).toHaveBeenCalledWith('played', 'current');
    expect(mockAudioState.play).not.toHaveBeenCalled();
    expect(mockAudioState.loadTrack).not.toHaveBeenCalled();
    expect(mockAddNotification).toHaveBeenCalledWith({ type: 'success', message: 'Добавлен следующим' });
    expect(mockClose).toHaveBeenCalledTimes(1);

    mockProjectState.sessionState.playedTrackIds = [];
    rerender(<TrackActionsDropdown trackId="played" anchorRect={new DOMRect()} onClose={mockClose} />);

    expect(screen.queryByRole('button', { name: 'Добавить следующим' })).not.toBeInTheDocument();
  });

  it('does not announce success when the insertion fails', () => {
    mockAddPlayedTrackNext.mockReturnValue(false);
    render(<TrackActionsDropdown trackId="played" anchorRect={new DOMRect()} onClose={mockClose} />);

    fireEvent.click(screen.getByRole('button', { name: 'Добавить следующим' }));

    expect(mockAddPlayedTrackNext).toHaveBeenCalledWith('played', 'current');
    expect(mockAddNotification).not.toHaveBeenCalled();
    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  it('keeps the existing jump action available without menu roles', () => {
    const onJumpToTrack = jest.fn().mockResolvedValue(undefined);
    render(
      <TrackActionsDropdown
        trackId="played"
        anchorRect={new DOMRect()}
        onClose={mockClose}
        onJumpToTrack={onJumpToTrack}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Играть с этого места' }));

    expect(onJumpToTrack).toHaveBeenCalledWith('played');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('adds a fully played group via addPlayedGroupNext with the group id', () => {
    mockAddPlayedGroupNext.mockReturnValue(true);
    mockProjectState.sessionState.playedTrackIds = ['g1', 'g2'];

    render(
      <TrackActionsDropdown
        trackId="group"
        anchorRect={new DOMRect()}
        onClose={mockClose}
        onJumpToTrack={jest.fn().mockResolvedValue(undefined)}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Добавить следующим' }));
    expect(mockAddPlayedGroupNext).toHaveBeenCalledWith('group', 'current');
    expect(mockAddPlayedTrackNext).not.toHaveBeenCalled();
    expect(mockAddNotification).toHaveBeenCalledWith({ type: 'success', message: 'Добавлен следующим' });
    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  it('resolves a group jump to its first track in playlist order', () => {
    mockProjectState.sessionState.playedTrackIds = [];
    const onJumpToTrack = jest.fn().mockResolvedValue(undefined);

    render(
      <TrackActionsDropdown
        trackId="group"
        anchorRect={new DOMRect()}
        onClose={mockClose}
        onJumpToTrack={onJumpToTrack}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Играть с этого места' }));
    expect(onJumpToTrack).toHaveBeenCalledWith('g1');
    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  it('hides add-next for a group that is not fully played', () => {
    mockProjectState.sessionState.playedTrackIds = ['g1'];
    render(
      <TrackActionsDropdown
        trackId="group"
        anchorRect={new DOMRect()}
        onClose={mockClose}
        onJumpToTrack={jest.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Добавить следующим' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Играть с этого места' })).toBeInTheDocument();
  });

  it('shows empty state for an empty group even when jump is provided', () => {
    render(
      <TrackActionsDropdown
        trackId="empty-group"
        anchorRect={new DOMRect()}
        onClose={mockClose}
        onJumpToTrack={jest.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Добавить следующим' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Играть с этого места' })).not.toBeInTheDocument();
    expect(screen.getByText('Нет доступных действий')).toBeInTheDocument();
  });
});
