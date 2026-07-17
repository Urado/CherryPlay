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
      markTrackAsMissing: jest.fn(),
    }),
  }),
}));

jest.mock('../../src/shared/stores/projectStore', () => {
  const projectState = {
    markTrackAsMissing: jest.fn(),
    findItemById: jest.fn(() => undefined),
  };

  const useProjectStore = Object.assign(() => projectState, {
    getState: () => projectState,
    subscribe: (listener: (state: typeof projectState, prevState: typeof projectState) => void) => {
      listener(projectState, projectState);
      return () => undefined;
    },
  });

  return { useProjectStore };
});

jest.mock('../../src/shared/stores/demoPlayerStore', () => ({
  useDemoPlayerStore: {
    getState: () => ({
      status: 'idle',
      pause: jest.fn(),
      setDisabled: jest.fn(),
    }),
  },
}));

jest.mock('../../src/shared/stores/playbackDeviceConflictSync', () => ({
  syncMainWithDemoPlayer: jest.fn(),
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

let usePlayerAudioStore: typeof import('../../src/shared/stores/playerAudioStore').usePlayerAudioStore;

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

  ({ usePlayerAudioStore } = await import('../../src/shared/stores/playerAudioStore'));
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

  usePlayerAudioStore.getState().clear();
});

const createTrack = (overrides: Partial<Track> = {}): Track => ({
  id: 'track-1',
  name: 'Player Track',
  path: 'D:/Music/player-track.flac',
  duration: 200,
  ...overrides,
});

describe('playerAudioStore', () => {
  it('loads track and resets playback state', async () => {
    const track = createTrack();
    await usePlayerAudioStore.getState().loadTrack(track);

    const state = usePlayerAudioStore.getState();
    expect(state.currentTrack).toEqual({ ...track, isMissing: false });
    expect(state.position).toBe(0);
    expect(state.status).toBe('paused');
    expect(state.error).toBeNull();
    expect(mockedGetAudioFileUrl).toHaveBeenCalledWith(track.path, false);
  });

  it('plays current track and updates status', async () => {
    const track = createTrack();
    const store = usePlayerAudioStore.getState();
    await store.loadTrack(track);

    await store.play();
    const audio = MockAudio.lastInstance();

    expect(audio?.play).toHaveBeenCalledTimes(1);
    expect(usePlayerAudioStore.getState().status).toBe('playing');
  });

  it('stops engine on handleError', async () => {
    const track = createTrack();
    const store = usePlayerAudioStore.getState();
    await store.loadTrack(track);
    await store.play();

    const audio = MockAudio.lastInstance();
    audio?.pause.mockClear();

    store.handleError('Test error', new Error('Test error'));

    expect(audio?.pause).toHaveBeenCalled();
    const state = usePlayerAudioStore.getState();
    expect(state.status).toBe('error');
    expect(state.error).toBe('Test error');
  });

  it('propagates play errors via engine error event only once', async () => {
    const track = createTrack();
    const store = usePlayerAudioStore.getState();
    await store.loadTrack(track);

    const audio = MockAudio.lastInstance();
    audio!.play.mockRejectedValueOnce(new Error('blocked'));
    audio?.pause.mockClear();

    await expect(store.play()).rejects.toThrow('blocked');
    const state = usePlayerAudioStore.getState();
    expect(state.status).toBe('error');
    expect(state.error).toBe('blocked');
    expect(audio?.pause).toHaveBeenCalledTimes(1);
  });
});
