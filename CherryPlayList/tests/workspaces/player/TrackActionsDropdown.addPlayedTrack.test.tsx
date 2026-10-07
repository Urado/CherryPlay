const mockAddPlayedTrackNext = jest.fn();
const mockAddNotification = jest.fn();
const mockClose = jest.fn();
const mockProjectState = {
  sessionState: { mode: 'session', playedTrackIds: ['played'], currentTrackId: 'current' },
  findItemById: (id: string) => (id === 'current' ? { id, path: 'current.mp3' } : null),
};
const mockAudioState = { currentTrack: null, play: jest.fn(), loadTrack: jest.fn() };

jest.mock('../../../src/workspaces/player/addPlayedTrackNext', () => ({
  addPlayedTrackNext: (...args: unknown[]) => mockAddPlayedTrackNext(...args) as void,
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
});
