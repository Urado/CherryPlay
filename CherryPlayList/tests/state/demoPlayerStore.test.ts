import { Buffer } from 'buffer';

import { ipcService } from '../../src/services/ipcService';
import type { Track } from '../../src/types/track';

jest.mock('../../src/services/ipcService', () => ({
  ipcService: {
    getAudioFileSource: jest.fn().mockResolvedValue({
      buffer: Buffer.from('mock-audio').toString('base64'),
      mimeType: 'audio/mpeg',
    }),
  },
}));

const mockedGetAudioFileSource = ipcService.getAudioFileSource as jest.MockedFunction<
  typeof ipcService.getAudioFileSource
>;

let useDemoPlayerStore: typeof import('../../src/state/demoPlayerStore').useDemoPlayerStore;

type Listener = () => void;

class MockAudio {
  static instances: MockAudio[] = [];

  public src = '';
  public currentTime = 0;
  public volume = 1;
  public duration = 180;
  public error: Partial<MediaError> | null = null;

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

const originalCreateObjectURL: typeof URL.createObjectURL | undefined =
  typeof URL !== 'undefined' && URL.createObjectURL ? URL.createObjectURL : undefined;
const originalRevokeObjectURL: typeof URL.revokeObjectURL | undefined =
  typeof URL !== 'undefined' && URL.revokeObjectURL ? URL.revokeObjectURL : undefined;

beforeAll(async () => {
  // @ts-expect-error override global Audio for tests
  global.Audio = MockAudio as unknown as typeof Audio;
  if (typeof URL !== 'undefined') {
    // @ts-expect-error override URL methods for tests
    URL.createObjectURL = jest.fn(() => 'blob:mock-url') as typeof URL.createObjectURL;
    // @ts-expect-error override URL methods for tests
    URL.revokeObjectURL = jest.fn() as typeof URL.revokeObjectURL;
  } else {
    // @ts-expect-error provide minimal URL polyfill for tests
    global.URL = {
      createObjectURL: jest.fn(() => 'blob:mock-url'),
      revokeObjectURL: jest.fn(),
    } as unknown as typeof URL;
  }
  ({ useDemoPlayerStore } = await import('../../src/state/demoPlayerStore'));
});

afterAll(() => {
  if (originalCreateObjectURL) {
    URL.createObjectURL = originalCreateObjectURL;
  }
  if (originalRevokeObjectURL) {
    URL.revokeObjectURL = originalRevokeObjectURL;
  }
});

beforeEach(() => {
  const existingAudio = MockAudio.lastInstance();
  if (existingAudio) {
    existingAudio.play.mockClear();
    existingAudio.pause.mockClear();
    existingAudio.currentTime = 0;
    existingAudio.error = null;
  }
  useDemoPlayerStore.getState().clear();
  mockedGetAudioFileSource.mockResolvedValue({
    buffer: Buffer.from('mock-audio').toString('base64'),
    mimeType: 'audio/mpeg',
  });
  if (typeof URL !== 'undefined') {
    (URL.createObjectURL as jest.Mock).mockClear();
    (URL.revokeObjectURL as jest.Mock).mockClear();
  }
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
    expect(state.currentTrack).toEqual(track);
    expect(state.sourceWorkspaceId).toBe('workspace-1');
    expect(state.position).toBe(0);
    expect(state.status).toBe('paused');
    expect(state.error).toBeNull();
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
    const audio = MockAudio.lastInstance();
    expect(audio?.volume).toBeCloseTo(0.33);

    store.clear();
    expect(MockAudio.lastInstance()?.pause).toHaveBeenCalled();
    expect(useDemoPlayerStore.getState().volume).toBeCloseTo(0.33);
  });

  it('clears audio element and revokes object url', async () => {
    const track = createTrack();
    const store = useDemoPlayerStore.getState();
    store.setVolume(0.5);
    await store.loadTrack(track, 'workspace-1');

    const audio = MockAudio.lastInstance();
    audio?.pause.mockClear();
    store.clear();
    expect(audio?.pause).toHaveBeenCalledTimes(1);
    expect(audio?.src).toBe('');
    expect(audio?.currentTime).toBe(0);
    expect(useDemoPlayerStore.getState().currentTrack).toBeNull();
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
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
    expect(state.status).toBe('idle');
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

  it('releases previous object url when loading new track', async () => {
    const track = createTrack();
    const otherTrack = createTrack({ id: 'track-2', path: 'D:/Music/other.flac' });
    const store = useDemoPlayerStore.getState();

    await store.loadTrack(track, 'workspace-1');
    await store.loadTrack(otherTrack, 'workspace-1');

    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(2);
  });

  it('propagates load errors and sets error message', async () => {
    const store = useDemoPlayerStore.getState();
    mockedGetAudioFileSource.mockRejectedValueOnce(new Error('fs failure'));

    await expect(store.loadTrack(createTrack(), 'workspace-1')).rejects.toThrow('fs failure');
    const state = useDemoPlayerStore.getState();
    expect(state.error).toBe('Не удалось загрузить файл для воспроизведения');
    expect(state.status).toBe('idle');
    expect(state.currentTrack).toBeNull();
  });

  it('propagates play errors and updates error state', async () => {
    const track = createTrack();
    const store = useDemoPlayerStore.getState();
    await store.loadTrack(track, 'workspace-1');

    const audio = MockAudio.lastInstance();
    audio!.play.mockRejectedValueOnce(new Error('blocked'));

    await expect(store.play()).rejects.toThrow('blocked');
    const state = useDemoPlayerStore.getState();
    expect(state.status).toBe('idle');
    expect(state.error).toBe('Не удалось воспроизвести трек');
  });
});
