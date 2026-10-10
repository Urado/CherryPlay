import { act, renderHook } from '@testing-library/react';

const tracks = [
  { id: 't1', path: 't1.mp3', name: 't1' },
  { id: 't2', path: 't2.mp3', name: 't2' },
  { id: 't3', path: 't3.mp3', name: 't3' },
  { id: 't4', path: 't4.mp3', name: 't4' },
];

const mockMarkTracksAsPlayed = jest.fn();
const mockUnmarkTracksAsPlayed = jest.fn();
const mockSetCurrentTrack = jest.fn();
const mockLoadTrack = jest.fn().mockResolvedValue(0);
const mockGetItemPath = jest.fn((id: string) => [id]);
const mockIsGroupDisabled = jest.fn().mockReturnValue(false);
const mockIsTrackDisabled = jest.fn().mockReturnValue(false);

const mockProjectState = {
  getAllTracksInOrder: () => tracks,
  markTracksAsPlayed: mockMarkTracksAsPlayed,
  unmarkTracksAsPlayed: mockUnmarkTracksAsPlayed,
  getItemPath: mockGetItemPath,
  isGroupDisabled: mockIsGroupDisabled,
  isTrackDisabled: mockIsTrackDisabled,
  toggleGroupDisabled: jest.fn(),
  toggleTrackDisabled: jest.fn(),
  setCurrentTrack: mockSetCurrentTrack,
};

jest.mock('../../../src/shared/stores', () => ({
  useProjectStore: {
    getState: () => mockProjectState,
  },
}));

jest.mock('../../../src/shared/stores/playerAudioStore', () => ({
  usePlayerAudioStore: {
    getState: () => ({
      loadTrack: mockLoadTrack,
    }),
  },
}));

jest.mock('../../../src/shared/utils', () => ({
  logger: { error: jest.fn() },
}));

import { useJumpToTrack } from '../../../src/workspaces/player/hooks/useJumpToTrack';

describe('useJumpToTrack', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('marks tracks before target and unmarks target and later when jumping backward', async () => {
    const { result } = renderHook(() => useJumpToTrack());

    await act(async () => {
      await result.current.jumpToTrack('t2');
    });

    expect(mockMarkTracksAsPlayed).toHaveBeenCalledWith(['t1']);
    expect(mockUnmarkTracksAsPlayed).toHaveBeenCalledWith(['t2', 't3', 't4']);
    expect(mockLoadTrack).toHaveBeenCalledWith(tracks[1]);
    expect(mockSetCurrentTrack).toHaveBeenCalledWith('t2');
  });

  it('unmarks only tracks from target onward when jumping forward past played history', async () => {
    const { result } = renderHook(() => useJumpToTrack());

    await act(async () => {
      await result.current.jumpToTrack('t4');
    });

    expect(mockMarkTracksAsPlayed).toHaveBeenCalledWith(['t1', 't2', 't3']);
    expect(mockUnmarkTracksAsPlayed).toHaveBeenCalledWith(['t4']);
  });
});
