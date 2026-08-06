const mockPlay = jest.fn(async () => undefined);
const mockPause = jest.fn();
const mockDemoPlay = jest.fn(async () => undefined);
const mockDemoPause = jest.fn();

let sessionMode: 'preparation' | 'session' = 'preparation';
let currentTrack: { id: string } | null = { id: 'track-1' };
let playerStatus: 'idle' | 'playing' | 'paused' | 'ended' = 'idle';

jest.mock('@shared/stores', () => ({
  useProjectStore: {
    getState: () => ({
      sessionState: { mode: sessionMode },
    }),
  },
  usePlayerAudioStore: {
    getState: () => ({
      currentTrack,
      status: playerStatus,
      play: mockPlay,
      pause: mockPause,
    }),
  },
  useDemoPlayerStore: {
    getState: () => ({
      currentTrack,
      status: playerStatus,
      play: mockDemoPlay,
      pause: mockDemoPause,
      isDisabled: false,
      error: null,
    }),
  },
  useUIStore: {
    getState: () => ({
      addNotification: jest.fn(),
    }),
  },
}));

import { toggleSessionPlayPause } from '../../../src/shared/utils/togglePlayPause';

describe('toggleSessionPlayPause', () => {
  beforeEach(() => {
    sessionMode = 'preparation';
    currentTrack = { id: 'track-1' };
    playerStatus = 'idle';
    mockPlay.mockClear();
    mockPause.mockClear();
    mockDemoPlay.mockClear();
    mockDemoPause.mockClear();
  });

  it('is a no-op when mode is not session', () => {
    sessionMode = 'preparation';
    playerStatus = 'playing';

    toggleSessionPlayPause();

    expect(mockPlay).not.toHaveBeenCalled();
    expect(mockPause).not.toHaveBeenCalled();
    expect(mockDemoPlay).not.toHaveBeenCalled();
    expect(mockDemoPause).not.toHaveBeenCalled();
  });

  it('calls pause when session has a playing track', () => {
    sessionMode = 'session';
    currentTrack = { id: 'track-1' };
    playerStatus = 'playing';

    toggleSessionPlayPause();

    expect(mockPause).toHaveBeenCalledTimes(1);
    expect(mockPlay).not.toHaveBeenCalled();
    expect(mockDemoPlay).not.toHaveBeenCalled();
    expect(mockDemoPause).not.toHaveBeenCalled();
  });

  it('calls play when session has a track that is not playing', async () => {
    sessionMode = 'session';
    currentTrack = { id: 'track-1' };
    playerStatus = 'paused';

    toggleSessionPlayPause();

    await Promise.resolve();

    expect(mockPlay).toHaveBeenCalledTimes(1);
    expect(mockPause).not.toHaveBeenCalled();
    expect(mockDemoPlay).not.toHaveBeenCalled();
    expect(mockDemoPause).not.toHaveBeenCalled();
  });

  it('is a no-op when session has no currentTrack', () => {
    sessionMode = 'session';
    currentTrack = null;
    playerStatus = 'paused';

    toggleSessionPlayPause();

    expect(mockPlay).not.toHaveBeenCalled();
    expect(mockPause).not.toHaveBeenCalled();
    expect(mockDemoPlay).not.toHaveBeenCalled();
    expect(mockDemoPause).not.toHaveBeenCalled();
  });
});
