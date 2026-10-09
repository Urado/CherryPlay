import { act, renderHook } from '@testing-library/react';

const mockTrack = {
  id: 'track-1',
  name: 'Last track',
  path: 'last-track.mp3',
  duration: 180,
};

let mockOnTrackEnded: (() => Promise<void>) | undefined;

const mockAudioState = {
  currentTrack: mockTrack,
  status: 'ended',
  loadTrack: jest.fn((_track: typeof mockTrack) => Promise.resolve(1)),
  play: jest.fn(() => Promise.resolve()),
  setOnTrackEnded: jest.fn((callback: (() => Promise<void>) | undefined) => {
    mockOnTrackEnded = callback;
  }),
  setPauseTimer: jest.fn((_callback: () => void, _delayMs: number) => undefined),
  clearPauseTimer: jest.fn(() => undefined),
  stop: jest.fn(() => undefined),
  shouldAutoPlayTrack: jest.fn(
    (trackId: string, generation: number) => trackId === 'track-2' && generation === 1,
  ),
};

const mockProjectState = {
  sessionState: { mode: 'session' },
  meta: { linkedParty: null },
};

jest.mock('@shared/hooks/usePlaybackPreview', () => ({
  usePlaybackPreview: () => ({
    startPlayback: jest.fn(),
    pausePlayback: jest.fn(),
    activeTrackId: null,
    playerStatus: 'idle',
  }),
}));

jest.mock('@shared/stores', () => ({
  usePlayerAudioStore: Object.assign(() => mockAudioState, {
    getState: () => mockAudioState,
  }),
  useAimpStore: {
    getState: () => ({ bridgeState: { liveStreamStarted: false } }),
  },
  useProjectStore: Object.assign(
    (selector: (state: typeof mockProjectState) => unknown) => selector(mockProjectState),
    { getState: () => mockProjectState },
  ),
  useSettingsStore: { getState: () => ({ streamingSource: 'cherryPlayPlayer' }) },
}));

jest.mock('@workspaces/party/partyProgramEndedStore', () => ({
  markPartyProgramEnded: jest.fn(),
}));

jest.mock('@workspaces/party/partyWorkspaceStore', () => ({
  usePartyWorkspaceStore: { getState: () => ({ partyLifecycleState: 'ready' }) },
}));

import { usePlayerPlayback } from '../../../src/workspaces/player/hooks/usePlayerPlayback';

describe('usePlayerPlayback final track transitions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOnTrackEnded = undefined;
  });

  const createOptions = (nextTrack: typeof mockTrack | null) => ({
    allTracks: [mockTrack],
    getEffectiveTrackSettings: () => ({ actionAfterTrack: 'next', pauseBetweenTracks: 0 }),
    getNextActiveTrack: () => nextTrack,
    markTrackAsPlayed: jest.fn(),
    markSkippedDisabledTracks: jest.fn(),
    setCurrentTrack: jest.fn(),
  });

  it('retains the final current track when natural playback ends', async () => {
    const options = createOptions(null);
    renderHook(() => usePlayerPlayback(options));

    await act(async () => {
      await mockOnTrackEnded?.();
    });

    expect(options.markTrackAsPlayed).toHaveBeenCalledWith(mockTrack.id);
    expect(options.setCurrentTrack).not.toHaveBeenCalledWith(null);
  });

  it('updates the current track when natural playback advances', async () => {
    const nextTrack = { ...mockTrack, id: 'track-2', name: 'Next track' };
    const options = createOptions(nextTrack);
    renderHook(() => usePlayerPlayback(options));

    await act(async () => {
      await mockOnTrackEnded?.();
    });

    expect(mockAudioState.loadTrack).toHaveBeenCalledWith(nextTrack, true);
    expect(mockAudioState.shouldAutoPlayTrack).toHaveBeenCalledWith(nextTrack.id, 1);
    expect(options.setCurrentTrack).toHaveBeenCalledWith(nextTrack.id);
    expect(options.setCurrentTrack).not.toHaveBeenCalledWith(null);
    expect(mockAudioState.play).toHaveBeenCalledTimes(1);
  });

  it('retains the final current track when manual next reaches the end', async () => {
    const options = createOptions(null);
    const { result } = renderHook(() => usePlayerPlayback(options));

    await act(async () => {
      await result.current.handleNext();
    });

    expect(mockAudioState.stop).toHaveBeenCalledTimes(1);
    expect(options.setCurrentTrack).not.toHaveBeenCalledWith(null);
  });
});
