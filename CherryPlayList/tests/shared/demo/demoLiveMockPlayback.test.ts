import type { Track } from '../../../src/core/types/track';

const storeState = {
  currentTrack: null as Track | null,
  status: 'idle' as string,
  position: 0,
  duration: 0,
  error: null as string | null,
  setPosition: jest.fn((position: number) => {
    storeState.position = position;
  }),
  handleEnded: jest.fn(() => {
    storeState.status = 'ended';
    storeState.position = storeState.duration;
  }),
};

jest.mock('../../../src/shared/stores/playerAudioStore', () => ({
  usePlayerAudioStore: {
    getState: () => storeState,
    setState: (partial: Partial<typeof storeState>) => {
      Object.assign(storeState, partial);
    },
  },
}));

describe('demoLiveMockPlayback', () => {
  const originalDemoLive = process.env.VITE_DEMO_LIVE;

  const sampleTrack: Track = {
    id: 'track-1',
    name: 'Demo Track',
    path: '/demo/track-1.mp3',
    duration: 10,
  };

  beforeEach(() => {
    jest.useFakeTimers();
    process.env.VITE_DEMO_LIVE = '1';
    storeState.currentTrack = null;
    storeState.status = 'idle';
    storeState.position = 0;
    storeState.duration = 0;
    storeState.error = null;
    storeState.setPosition.mockClear();
    storeState.handleEnded.mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
    if (originalDemoLive === undefined) {
      delete process.env.VITE_DEMO_LIVE;
    } else {
      process.env.VITE_DEMO_LIVE = originalDemoLive;
    }
  });

  test('isDemoLiveMockPlaybackEnabled follows VITE_DEMO_LIVE', async () => {
    const { isDemoLiveMockPlaybackEnabled, stopDemoLiveMockPlayback } =
      await import('../../../src/shared/demo/demoLiveMockPlayback');
    expect(isDemoLiveMockPlaybackEnabled()).toBe(true);
    delete process.env.VITE_DEMO_LIVE;
    expect(isDemoLiveMockPlaybackEnabled()).toBe(false);
    stopDemoLiveMockPlayback();
  });

  test('start sets track playing and advances position until ended', async () => {
    const { startDemoLiveMockPlayback, stopDemoLiveMockPlayback } =
      await import('../../../src/shared/demo/demoLiveMockPlayback');

    startDemoLiveMockPlayback(sampleTrack);

    expect(storeState.currentTrack?.id).toBe('track-1');
    expect(storeState.status).toBe('playing');
    expect(storeState.duration).toBe(10);
    expect(storeState.position).toBe(0);

    jest.advanceTimersByTime(500);
    expect(storeState.setPosition).toHaveBeenCalled();
    expect(storeState.position).toBeGreaterThan(0);

    jest.advanceTimersByTime(10_000);
    expect(storeState.handleEnded).toHaveBeenCalled();
    expect(storeState.status).toBe('ended');

    stopDemoLiveMockPlayback();
  });

  test('pause stops ticker and play resumes', async () => {
    const {
      startDemoLiveMockPlayback,
      pauseDemoLiveMockPlayback,
      playDemoLiveMockPlayback,
      stopDemoLiveMockPlayback,
    } = await import('../../../src/shared/demo/demoLiveMockPlayback');

    startDemoLiveMockPlayback(sampleTrack);
    jest.advanceTimersByTime(1000);
    const positionAfterTick = storeState.position;

    pauseDemoLiveMockPlayback();
    expect(storeState.status).toBe('paused');

    jest.advanceTimersByTime(2000);
    expect(storeState.position).toBe(positionAfterTick);

    playDemoLiveMockPlayback();
    expect(storeState.status).toBe('playing');
    jest.advanceTimersByTime(500);
    expect(storeState.position).toBeGreaterThan(positionAfterTick);

    stopDemoLiveMockPlayback();
  });

  test('load uses fallback duration when track has none', async () => {
    const { loadDemoLiveMockTrack, stopDemoLiveMockPlayback } =
      await import('../../../src/shared/demo/demoLiveMockPlayback');

    loadDemoLiveMockTrack({
      id: 'track-2',
      name: 'No Duration',
      path: '/demo/track-2.mp3',
    });

    expect(storeState.status).toBe('paused');
    expect(storeState.duration).toBe(180);

    stopDemoLiveMockPlayback();
  });
});
