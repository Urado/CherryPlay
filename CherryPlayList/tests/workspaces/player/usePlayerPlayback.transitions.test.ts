import { act, renderHook } from '@testing-library/react';

import type { Track } from '../../../src/core/types/track';
import { usePlayerPlayback } from '../../../src/workspaces/player/hooks/usePlayerPlayback';

const mockCurrentTrack: Track = {
  id: 'current',
  name: 'Current',
  path: 'current.mp3',
  duration: 180,
};
const mockDisabledTrack: Track = {
  id: 'disabled',
  name: 'Disabled',
  path: 'disabled.mp3',
  duration: 180,
};
const mockNextTrack: Track = {
  id: 'next',
  name: 'Next',
  path: 'next.mp3',
  duration: 180,
};

let mockOnTrackEnded: (() => Promise<void>) | undefined;
let mockPauseTimerCallback: (() => Promise<void>) | undefined;

const mockAudioState = {
  currentTrack: mockCurrentTrack,
  status: 'ended',
  loadTrack: jest.fn((_track: Track) => Promise.resolve()),
  play: jest.fn(() => Promise.resolve()),
  setOnTrackEnded: jest.fn((callback: (() => void) | undefined) => {
    mockOnTrackEnded = callback as (() => Promise<void>) | undefined;
  }),
  setPauseTimer: jest.fn((callback: () => Promise<void>, _delayMs: number) => {
    mockPauseTimerCallback = callback;
  }),
  clearPauseTimer: jest.fn(() => undefined),
  stop: jest.fn(() => undefined),
};

const mockProjectState = {
  sessionState: { mode: 'session' },
  meta: { linkedParty: { id: 'party-1', shortCode: 'party' } },
};
const mockMarkPartyProgramEnded = jest.fn();

jest.mock('@shared/hooks/usePlaybackPreview', () => ({
  usePlaybackPreview: () => ({
    startPlayback: jest.fn(),
    pausePlayback: jest.fn(),
    activeTrackId: null,
    playerStatus: 'idle',
  }),
}));

jest.mock('@shared/stores', () => ({
  usePlayerAudioStore: () => mockAudioState,
  useProjectStore: Object.assign(
    (selector: (state: typeof mockProjectState) => unknown) => selector(mockProjectState),
    { getState: () => mockProjectState },
  ),
  useSettingsStore: { getState: () => ({ streamingSource: 'cherryPlayPlayer' }) },
}));

jest.mock('@workspaces/party/partyProgramEndedStore', () => ({
  markPartyProgramEnded: (...args: unknown[]) => {
    mockMarkPartyProgramEnded(...args);
  },
}));

jest.mock('@workspaces/party/partyWorkspaceStore', () => ({
  usePartyWorkspaceStore: { getState: () => ({ partyLifecycleState: 'ready' }) },
}));

describe('usePlayerPlayback pause transitions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOnTrackEnded = undefined;
    mockPauseTimerCallback = undefined;
    mockAudioState.currentTrack = mockCurrentTrack;
    mockAudioState.status = 'ended';
    mockProjectState.meta.linkedParty = { id: 'party-1', shortCode: 'party' };
  });

  it('marks trailing disabled tracks skipped and retains the ended current track', async () => {
    const options = {
      allTracks: [mockCurrentTrack, mockDisabledTrack],
      getEffectiveTrackSettings: () => ({
        actionAfterTrack: 'pauseAndNext',
        pauseBetweenTracks: 4,
      }),
      getNextActiveTrack: () => null,
      markTrackAsPlayed: jest.fn(),
      markSkippedDisabledTracks: jest.fn(),
      setCurrentTrack: jest.fn(),
    };
    renderHook(() => usePlayerPlayback(options));

    await act(async () => {
      await mockOnTrackEnded?.();
    });

    expect(options.markSkippedDisabledTracks).toHaveBeenCalledWith(0, 2);
    expect(options.setCurrentTrack).not.toHaveBeenCalledWith(null);
    expect(mockMarkPartyProgramEnded).toHaveBeenCalledTimes(1);
  });

  it('schedules playback after the pause between active tracks', async () => {
    const options = {
      allTracks: [mockCurrentTrack, mockDisabledTrack, mockNextTrack],
      getEffectiveTrackSettings: () => ({
        actionAfterTrack: 'pauseAndNext',
        pauseBetweenTracks: 4,
      }),
      getNextActiveTrack: () => mockNextTrack,
      markTrackAsPlayed: jest.fn(),
      markSkippedDisabledTracks: jest.fn(),
      setCurrentTrack: jest.fn(),
    };
    const { rerender } = renderHook(() => usePlayerPlayback(options));

    await act(async () => {
      await mockOnTrackEnded?.();
    });

    expect(options.markSkippedDisabledTracks).toHaveBeenCalledWith(0, 2);
    expect(mockAudioState.loadTrack).toHaveBeenCalledWith(mockNextTrack);
    expect(options.setCurrentTrack).toHaveBeenCalledWith(mockNextTrack.id);
    expect(mockAudioState.setPauseTimer).toHaveBeenCalledWith(expect.any(Function), 4000);

    mockAudioState.currentTrack = mockNextTrack;
    mockAudioState.status = 'paused';
    rerender();
    await act(async () => {
      await mockPauseTimerCallback?.();
    });

    expect(mockAudioState.play).toHaveBeenCalledTimes(1);
  });
});
