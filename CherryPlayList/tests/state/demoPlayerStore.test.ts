import type { Track } from '../../src/core/types/track';
import { ipcService } from '../../src/shared/services/ipcService';

jest.mock('../../src/shared/platform/appMode', () => ({
  getAppMode: jest.fn(() => 'electron'),
}));

jest.mock('../../src/shared/stores/settingsStore', () => {
  const deviceState = {
    playerAudioDeviceId: null as string | null,
    demoPlayerAudioDeviceId: null as string | null,
    loudnessNormalizationEnabled: true,
    loudnessTargetLufs: -18,
    loudnessCompressionEnabled: false,
    loudnessQuietGapRangeLu: 15,
  };

  const useSettingsStore = Object.assign(
    (selector?: (state: typeof deviceState) => unknown) => {
      if (selector) {
        return selector(deviceState);
      }
      return deviceState;
    },
    {
      getState: () => ({
        ...deviceState,
        setPlayerAudioDeviceId: (id: string | null) => {
          deviceState.playerAudioDeviceId = id;
        },
        setDemoPlayerAudioDeviceId: (id: string | null) => {
          deviceState.demoPlayerAudioDeviceId = id;
        },
      }),
      subscribe: (listener: (state: typeof deviceState, prevState: typeof deviceState) => void) => {
        listener(deviceState, deviceState);
        return () => undefined;
      },
    },
  );

  return { useSettingsStore };
});

jest.mock('../../src/shared/stores/uiStore', () => ({
  useUIStore: {
    getState: () => ({
      addNotification: jest.fn(),
    }),
  },
}));

jest.mock('../../src/shared/stores/projectStoreFactory', () => ({
  getProjectStore: () => ({
    getState: () => ({
      sessionState: { mode: 'preparation' },
    }),
  }),
}));

jest.mock('../../src/shared/stores/playerAudioStore', () => ({
  usePlayerAudioStore: {
    getState: () => ({
      status: 'idle',
      pause: jest.fn(),
    }),
  },
}));

jest.mock('../../src/shared/services/ipcService', () => ({
  ipcService: {
    getAudioFileUrl: jest.fn().mockResolvedValue({ url: 'cherryplay-audio:///mock' }),
    getAudioDuration: jest.fn().mockResolvedValue(180),
    statFile: jest.fn().mockResolvedValue({ size: 1, modified: 0, isDirectory: false }),
  },
}));

const mockedGetAudioFileUrl = ipcService.getAudioFileUrl as jest.MockedFunction<
  typeof ipcService.getAudioFileUrl
>;

let useDemoPlayerStore: typeof import('../../src/shared/stores/demoPlayerStore').useDemoPlayerStore;

type Listener = () => void;

class MockGainNode {
  gain = { value: 1 };
  connect = jest.fn();
  disconnect = jest.fn();
}

class MockBiquadFilterNode {
  type = '';
  frequency = { value: 0 };
  Q = { value: 1 };
  gain = { value: 0 };
  connect = jest.fn();
  disconnect = jest.fn();
}

class MockMediaElementSource {
  connect = jest.fn();
  disconnect = jest.fn();
}

class MockDynamicsCompressorNode {
  threshold = { value: 0 };
  ratio = { value: 1 };
  knee = { value: 0 };
  attack = { value: 0 };
  release = { value: 0 };
  connect = jest.fn();
  disconnect = jest.fn();
}

class MockAudioContext {
  static instances: MockAudioContext[] = [];

  destination = {};
  state: AudioContextState = 'running';

  createGain = jest.fn(() => new MockGainNode());
  createBiquadFilter = jest.fn(() => new MockBiquadFilterNode());
  createDynamicsCompressor = jest.fn(() => new MockDynamicsCompressorNode());
  createMediaElementSource = jest.fn(() => new MockMediaElementSource());
  resume = jest.fn().mockResolvedValue(undefined);
  close = jest.fn().mockResolvedValue(undefined);

  constructor() {
    MockAudioContext.instances.push(this);
  }

  static reset(): void {
    MockAudioContext.instances = [];
  }
}

class MockAudio {
  static instances: MockAudio[] = [];

  public src = '';
  public currentTime = 0;
  public volume = 1;
  public duration = 180;
  public error: Partial<MediaError> | null = null;
  public preload = 'auto';
  public crossOrigin = 'anonymous';

  private listeners: Record<string, Listener[]> = {};

  public play = jest.fn().mockResolvedValue(undefined);
  public pause = jest.fn();

  constructor() {
    MockAudio.instances.push(this);
  }

  addEventListener(event: string, callback: Listener): void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  removeEventListener(event: string, callback: Listener): void {
    if (!this.listeners[event]) {
      return;
    }
    this.listeners[event] = this.listeners[event].filter((listener) => listener !== callback);
  }

  dispatch(event: string): void {
    (this.listeners[event] || []).forEach((listener) => listener());
  }

  static reset(): void {
    MockAudio.instances = [];
  }

  static lastInstance(): MockAudio | undefined {
    return MockAudio.instances[MockAudio.instances.length - 1];
  }
}

beforeAll(async () => {
  // @ts-expect-error override global Audio for tests
  global.Audio = MockAudio as unknown as typeof Audio;
  // @ts-expect-error override AudioContext for Web Audio engine
  global.AudioContext = MockAudioContext as unknown as typeof AudioContext;

  ({ useDemoPlayerStore } = await import('../../src/shared/stores/demoPlayerStore'));
});

beforeEach(() => {
  mockedGetAudioFileUrl.mockClear();
  mockedGetAudioFileUrl.mockResolvedValue({ url: 'cherryplay-audio:///mock' });

  const existingAudio = MockAudio.lastInstance();
  if (existingAudio) {
    existingAudio.play.mockClear();
    existingAudio.pause.mockClear();
    existingAudio.currentTime = 0;
    existingAudio.error = null;
    existingAudio.src = '';
  }

  useDemoPlayerStore.getState().clear();
});

const createTrack = (overrides: Partial<Track> = {}): Track => ({
  id: 'track-1',
  name: 'Demo Track',
  path: 'D:/Music/demo-track.flac',
  duration: 200,
  ...overrides,
});

describe('demoPlayerStore', () => {
  it('loads track and resets playback state', async () => {
    const track = createTrack();
    await useDemoPlayerStore.getState().loadTrack(track, 'workspace-1');

    const state = useDemoPlayerStore.getState();
    expect(state.currentTrack).toEqual({ ...track, isMissing: false });
    expect(state.sourceWorkspaceId).toBe('workspace-1');
    expect(state.position).toBe(0);
    expect(state.status).toBe('paused');
    expect(state.error).toBeNull();
    expect(mockedGetAudioFileUrl).toHaveBeenCalledWith(track.path, false);
  });

  it('plays current track and updates status', async () => {
    const track = createTrack();
    const store = useDemoPlayerStore.getState();
    await store.loadTrack(track, 'workspace-1');

    await store.play();
    const audio = MockAudio.lastInstance();

    expect(audio?.play).toHaveBeenCalledTimes(1);
    expect(useDemoPlayerStore.getState().status).toBe('playing');
  });

  it('seeks to provided position', async () => {
    const track = createTrack();
    const store = useDemoPlayerStore.getState();
    await store.loadTrack(track, 'workspace-1');

    store.seek(42);
    const audio = MockAudio.lastInstance();

    expect(audio?.currentTime).toBe(42);
    expect(useDemoPlayerStore.getState().position).toBe(42);
  });

  it('clamps seek value and resumes from ended state', async () => {
    const track = createTrack({ duration: 120 });
    const store = useDemoPlayerStore.getState();
    await store.loadTrack(track, 'workspace-1');

    const audio = MockAudio.lastInstance();
    audio?.dispatch('ended');
    expect(useDemoPlayerStore.getState().status).toBe('ended');

    store.seek(999);
    expect(audio?.currentTime).toBe(track.duration);
    expect(useDemoPlayerStore.getState().position).toBe(track.duration);
    expect(useDemoPlayerStore.getState().status).toBe('paused');

    store.seek(-50);
    expect(audio?.currentTime).toBe(0);
    expect(useDemoPlayerStore.getState().position).toBe(0);
  });

  it('clamps volume between 0 and 1 and persists after clear', async () => {
    const store = useDemoPlayerStore.getState();
    store.setVolume(2);
    expect(useDemoPlayerStore.getState().volume).toBe(1);

    store.setVolume(-0.2);
    expect(useDemoPlayerStore.getState().volume).toBe(0);

    const track = createTrack();
    await store.loadTrack(track, 'workspace-1');
    store.setVolume(0.33);
    expect(useDemoPlayerStore.getState().volume).toBeCloseTo(0.33);

    store.clear();
    expect(MockAudio.lastInstance()?.pause).toHaveBeenCalled();
    expect(useDemoPlayerStore.getState().volume).toBeCloseTo(0.33);
  });

  it('clears playback state on clear', async () => {
    const track = createTrack();
    const store = useDemoPlayerStore.getState();
    store.setVolume(0.5);
    await store.loadTrack(track, 'workspace-1');

    const audio = MockAudio.lastInstance();
    audio?.pause.mockClear();
    store.clear();
    expect(audio?.pause).toHaveBeenCalled();
    expect(useDemoPlayerStore.getState().currentTrack).toBeNull();
  });

  it('handles audio errors gracefully', async () => {
    const track = createTrack();
    const store = useDemoPlayerStore.getState();
    await store.loadTrack(track, 'workspace-1');

    const audio = MockAudio.lastInstance();
    audio!.error = { code: 3 };
    audio?.dispatch('error');

    const state = useDemoPlayerStore.getState();
    expect(state.error).toContain('Невозможно декодировать аудио');
    expect(state.status).toBe('error');
  });

  it('marks playback as ended when audio finishes', async () => {
    const track = createTrack();
    const store = useDemoPlayerStore.getState();
    await store.loadTrack(track, 'workspace-1');

    const audio = MockAudio.lastInstance();
    audio?.dispatch('ended');

    const state = useDemoPlayerStore.getState();
    expect(state.status).toBe('ended');
    expect(state.position).toBe(track.duration);
  });

  it('loads subsequent tracks via protocol url adapter', async () => {
    const track = createTrack();
    const otherTrack = createTrack({ id: 'track-2', path: 'D:/Music/other.flac' });
    const store = useDemoPlayerStore.getState();

    await store.loadTrack(track, 'workspace-1');
    await store.loadTrack(otherTrack, 'workspace-1');

    expect(mockedGetAudioFileUrl).toHaveBeenCalledTimes(2);
    expect(MockAudio.lastInstance()?.src).toBe('cherryplay-audio:///mock');
  });

  it('propagates load errors and sets error message', async () => {
    const store = useDemoPlayerStore.getState();
    mockedGetAudioFileUrl.mockRejectedValueOnce(new Error('fs failure'));

    await expect(store.loadTrack(createTrack(), 'workspace-1')).rejects.toThrow('fs failure');
    const state = useDemoPlayerStore.getState();
    expect(state.error).toBe('fs failure');
    expect(state.status).toBe('error');
  });

  it('propagates play errors via engine error event only once', async () => {
    const track = createTrack();
    const store = useDemoPlayerStore.getState();
    await store.loadTrack(track, 'workspace-1');

    const audio = MockAudio.lastInstance();
    audio!.play.mockRejectedValueOnce(new Error('blocked'));
    audio?.pause.mockClear();

    await expect(store.play()).rejects.toThrow('blocked');
    const state = useDemoPlayerStore.getState();
    expect(state.status).toBe('error');
    expect(state.error).toBe('blocked');
    expect(audio?.pause).toHaveBeenCalledTimes(1);
  });
});
