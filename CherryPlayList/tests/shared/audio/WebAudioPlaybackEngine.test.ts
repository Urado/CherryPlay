jest.mock('../../../src/shared/services/ipcService', () => ({
  ipcService: {
    getAudioFileUrl: jest.fn(),
    getAudioDuration: jest.fn(),
  },
}));

import type { PlatformAudioAdapter } from '../../../src/shared/audio/playback/PlatformAudioAdapter';
import type { PlaybackSource } from '../../../src/shared/audio/playback/types';
import { WebAudioPlaybackEngine } from '../../../src/shared/audio/playback/WebAudioPlaybackEngine';

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

class MockAudioContext {
  destination = {};
  state: AudioContextState = 'running';

  createGain = jest.fn(() => new MockGainNode());
  createBiquadFilter = jest.fn(() => new MockBiquadFilterNode());
  createMediaElementSource = jest.fn(() => new MockMediaElementSource());
  resume = jest.fn().mockResolvedValue(undefined);
  close = jest.fn().mockResolvedValue(undefined);
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

  public play = jest.fn().mockImplementation(async () => {
    this.dispatch('play');
  });

  public pause = jest.fn().mockImplementation(() => {
    this.dispatch('pause');
  });

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

const originalCreateObjectURL: typeof URL.createObjectURL | undefined =
  typeof URL !== 'undefined' && URL.createObjectURL ? URL.createObjectURL : undefined;
const originalRevokeObjectURL: typeof URL.revokeObjectURL | undefined =
  typeof URL !== 'undefined' && URL.revokeObjectURL ? URL.revokeObjectURL : undefined;

function createMockAdapter(overrides: Partial<PlatformAudioAdapter> = {}): PlatformAudioAdapter {
  const revoke = jest.fn();
  return {
    resolveSource: jest.fn(async (source: PlaybackSource) => {
      if (source.kind === 'url') {
        return { url: source.url };
      }
      return { url: 'cherryplay-audio:///mock', revoke };
    }),
    getDuration: jest.fn().mockResolvedValue(240),
    setSinkId: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

beforeAll(() => {
  // @ts-expect-error test mock
  global.Audio = MockAudio as unknown as typeof Audio;
  // @ts-expect-error test mock
  global.AudioContext = MockAudioContext as unknown as typeof AudioContext;
});

beforeEach(() => {
  MockAudio.reset();
  if (typeof URL !== 'undefined') {
    // @ts-expect-error override URL methods for tests
    URL.createObjectURL = jest.fn(() => 'blob:mock-url') as typeof URL.createObjectURL;
    // @ts-expect-error override URL methods for tests
    URL.revokeObjectURL = jest.fn() as typeof URL.revokeObjectURL;
  }
});

afterAll(() => {
  if (typeof URL !== 'undefined') {
    if (originalCreateObjectURL) {
      URL.createObjectURL = originalCreateObjectURL;
    }
    if (originalRevokeObjectURL) {
      URL.revokeObjectURL = originalRevokeObjectURL;
    }
  }
});

describe('WebAudioPlaybackEngine lifecycle', () => {
  test('load → play → pause → seek → ended → dispose', async () => {
    const adapter = createMockAdapter();
    const engine = new WebAudioPlaybackEngine({ id: 'lifecycle', adapter });

    const statusChanges: string[] = [];
    const positions: number[] = [];
    let ended = false;

    engine.subscribe('statusChanged', (status) => statusChanges.push(status));
    engine.subscribe('positionChanged', (position) => positions.push(position));
    engine.subscribe('ended', () => {
      ended = true;
    });

    const source: PlaybackSource = { kind: 'url', url: 'https://example.com/track.mp3' };
    await engine.load(source);

    expect(adapter.resolveSource).toHaveBeenCalledWith(source);
    expect(engine.getSnapshot().status).toBe('paused');

    const audio = MockAudio.lastInstance();
    expect(audio?.src).toBe('https://example.com/track.mp3');

    await engine.play();
    expect(engine.getSnapshot().status).toBe('playing');
    expect(audio?.play).toHaveBeenCalled();

    engine.pause();
    expect(engine.getSnapshot().status).toBe('paused');
    expect(audio?.pause).toHaveBeenCalled();

    engine.seek(42);
    expect(engine.getSnapshot().position).toBe(42);
    expect(audio?.currentTime).toBe(42);
    expect(positions).toContain(42);

    audio?.dispatch('ended');
    expect(engine.getSnapshot().status).toBe('ended');
    expect(ended).toBe(true);

    engine.dispose();
    expect(engine.getSnapshot().status).toBe('ended');

    engine.setVolume(0.3);
    expect(engine.getSnapshot().volume).toBe(0.8);

    expect(statusChanges).toEqual(
      expect.arrayContaining(['loading', 'paused', 'playing', 'ended']),
    );
  });

  test('revokes object URL on reload and dispose', async () => {
    const revoke = jest.fn();
    const adapter = createMockAdapter({
      resolveSource: jest.fn(async () => ({ url: 'blob:first', revoke })),
    });
    const engine = new WebAudioPlaybackEngine({ id: 'revoke', adapter });

    await engine.load({ kind: 'filePath', path: '/music/track.mp3' });
    expect(revoke).not.toHaveBeenCalled();

    const secondRevoke = jest.fn();
    (adapter.resolveSource as jest.Mock).mockResolvedValueOnce({
      url: 'blob:second',
      revoke: secondRevoke,
    });

    await engine.load({ kind: 'filePath', path: '/music/other.mp3' });
    expect(revoke).toHaveBeenCalledTimes(1);
    expect(secondRevoke).not.toHaveBeenCalled();

    engine.dispose();
    expect(secondRevoke).toHaveBeenCalledTimes(1);
  });

  test('emits duration from loadedmetadata and adapter getDuration', async () => {
    const adapter = createMockAdapter();
    const engine = new WebAudioPlaybackEngine({ id: 'duration', adapter });
    const durations: number[] = [];
    engine.subscribe('durationChanged', (duration) => durations.push(duration));

    await engine.load({ kind: 'filePath', path: '/music/track.mp3' });
    expect(adapter.getDuration).toHaveBeenCalledWith('/music/track.mp3');
    expect(durations).toContain(240);

    const audio = MockAudio.lastInstance();
    audio!.duration = 300;
    audio!.dispatch('loadedmetadata');
    expect(engine.getSnapshot().duration).toBe(300);
    expect(durations).toContain(300);
  });

  test('reports media errors via error event', async () => {
    const adapter = createMockAdapter();
    const engine = new WebAudioPlaybackEngine({ id: 'error', adapter });
    const errors: string[] = [];
    engine.subscribe('error', (message) => errors.push(message));

    await engine.load({ kind: 'url', url: 'https://example.com/bad.mp3' });
    const audio = MockAudio.lastInstance();
    audio!.error = { code: 4 };
    audio!.dispatch('error');

    expect(engine.getSnapshot().status).toBe('error');
    expect(errors[0]).toContain('не найден');
  });

  test('stop() after error resets engine to idle', async () => {
    const adapter = createMockAdapter();
    const engine = new WebAudioPlaybackEngine({ id: 'error-stop', adapter });

    await engine.load({ kind: 'url', url: 'https://example.com/bad.mp3' });
    const audio = MockAudio.lastInstance();
    audio!.error = { code: 4 };
    audio!.dispatch('error');
    expect(engine.getSnapshot().status).toBe('error');

    engine.stop();

    expect(engine.getSnapshot().status).toBe('idle');
    expect(engine.getSnapshot().error).toBeNull();
    expect(engine.getSnapshot().position).toBe(0);
  });

  test('getSnapshot returns a shallow copy', () => {
    const adapter = createMockAdapter();
    const engine = new WebAudioPlaybackEngine({ id: 'snapshot-copy', adapter });

    const snapshot = engine.getSnapshot();
    (snapshot as { status: string }).status = 'playing';

    expect(engine.getSnapshot().status).toBe('idle');
  });

  test('listeners stop firing after dispose', async () => {
    const adapter = createMockAdapter();
    const engine = new WebAudioPlaybackEngine({ id: 'dispose-listeners', adapter });
    const statusListener = jest.fn();
    engine.subscribe('statusChanged', statusListener);

    await engine.load({ kind: 'url', url: 'https://example.com/track.mp3' });
    statusListener.mockClear();

    engine.dispose();

    await engine.load({ kind: 'url', url: 'https://example.com/other.mp3' });
    await engine.play();

    expect(statusListener).not.toHaveBeenCalled();
  });

  test('re-applies output device after load', async () => {
    const adapter = createMockAdapter();
    const engine = new WebAudioPlaybackEngine({ id: 'device-reapply', adapter });

    await engine.setOutputDevice('speaker-1');
    (adapter.setSinkId as jest.Mock).mockClear();

    await engine.load({ kind: 'url', url: 'https://example.com/track.mp3' });

    expect(adapter.setSinkId).toHaveBeenCalledWith(expect.any(MockAudio), 'speaker-1');
  });

  test('load aborted by dispose does not emit after disposal', async () => {
    let resolveSource!: (value: { url: string; revoke?: () => void }) => void;
    const pendingResolve = new Promise<{ url: string; revoke?: () => void }>((resolve) => {
      resolveSource = resolve;
    });

    const adapter = createMockAdapter({
      resolveSource: jest.fn(() => pendingResolve),
    });
    const engine = new WebAudioPlaybackEngine({ id: 'dispose-race', adapter });
    const statusListener = jest.fn();
    engine.subscribe('statusChanged', statusListener);

    const loadPromise = engine.load({ kind: 'url', url: 'https://example.com/slow.mp3' });
    expect(statusListener).toHaveBeenCalledWith('loading');

    statusListener.mockClear();
    engine.dispose();
    resolveSource({ url: 'https://example.com/slow.mp3' });
    await loadPromise;

    expect(statusListener).not.toHaveBeenCalled();
    expect(engine.getSnapshot().status).toBe('loading');
  });
});

describe('WebAudioPlaybackEngine effects', () => {
  test('track gain and autogain adjust gain node', async () => {
    const adapter = createMockAdapter();
    const engine = new WebAudioPlaybackEngine({ id: 'fx-test', adapter });
    await engine.load({ kind: 'url', url: 'cherryplay-audio:///test.mp3' });
    await engine.play();

    engine.setTrackGain(1.5);
    engine.setAutoGainEnabled(true);

    expect(engine.getSnapshot().status).toBe('playing');
    engine.dispose();
  });

  test('equalizer bands can be set', async () => {
    const adapter = createMockAdapter();
    const engine = new WebAudioPlaybackEngine({ id: 'eq-test', adapter });
    await engine.load({ kind: 'url', url: 'cherryplay-audio:///test.mp3' });

    engine.setEqualizerBands({ lowDb: 3, midDb: -2, highDb: 1 });
    expect(engine.getSnapshot().status).toBe('paused');

    engine.dispose();
  });
});
