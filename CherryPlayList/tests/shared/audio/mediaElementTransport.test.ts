import {
  MEDIA_ERROR_MESSAGES,
  MediaElementTransport,
} from '../../../src/shared/audio/playback/mediaElementTransport';
import type { PlatformAudioAdapter } from '../../../src/shared/audio/playback/PlatformAudioAdapter';
import type { PlaybackSource } from '../../../src/shared/audio/playback/types';

type Listener = () => void;

class MockAudio {
  static instances: MockAudio[] = [];

  public src = '';
  public currentTime = 0;
  public volume = 1;
  public duration = 180;
  public error: Partial<MediaError> | null = null;
  public preload = 'auto';
  public crossOrigin = 'anonymous';
  public paused = true;

  private listeners: Record<string, Listener[]> = {};

  public play = jest.fn().mockImplementation(async () => {
    this.paused = false;
    this.dispatch('play');
  });

  public pause = jest.fn().mockImplementation(() => {
    this.paused = true;
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

function createMockAdapter(overrides: Partial<PlatformAudioAdapter> = {}): PlatformAudioAdapter {
  return {
    resolveSource: jest.fn(async (source: PlaybackSource) => {
      if (source.kind === 'url') {
        return { url: source.url };
      }
      return { url: 'cherryplay-audio:///mock' };
    }),
    getDuration: jest.fn().mockResolvedValue(240),
    setSinkId: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function createTransport(adapter = createMockAdapter()): MediaElementTransport {
  return new MediaElementTransport({ id: 'transport-test', adapter });
}

beforeAll(() => {
  // @ts-expect-error test mock
  global.Audio = MockAudio as unknown as typeof Audio;
});

beforeEach(() => {
  MockAudio.reset();
});

describe('MediaElementTransport', () => {
  test('stop() resets error state to idle', async () => {
    const transport = createTransport();
    const statuses: string[] = [];
    transport.subscribe('statusChanged', (status) => statuses.push(status));

    await transport.load({ kind: 'url', url: 'https://example.com/bad.mp3' });
    const audio = MockAudio.lastInstance()!;
    audio.error = { code: 4 };
    audio.dispatch('error');

    expect(transport.getSnapshot().status).toBe('error');
    expect(transport.getSnapshot().error).toBeTruthy();

    transport.stop();

    expect(transport.getSnapshot().status).toBe('idle');
    expect(transport.getSnapshot().error).toBeNull();
    expect(transport.getSnapshot().position).toBe(0);
    expect(statuses).toContain('idle');
  });

  test('clear path via stop() after play() media error leaves engine ready for reload', async () => {
    const transport = createTransport();

    await transport.load({ kind: 'url', url: 'https://example.com/track.mp3' });
    await transport.play();

    const audio = MockAudio.lastInstance()!;
    audio.error = { code: 2 };
    audio.dispatch('error');
    expect(transport.getSnapshot().status).toBe('error');

    transport.stop();
    expect(transport.getSnapshot().status).toBe('idle');

    await transport.load({ kind: 'url', url: 'https://example.com/other.mp3' });
    expect(transport.getSnapshot().status).toBe('paused');
    expect(transport.getSnapshot().error).toBeNull();
  });

  test('waiting transitions playing to buffering and canplay resumes', async () => {
    const transport = createTransport();

    await transport.load({ kind: 'url', url: 'https://example.com/track.mp3' });
    await transport.play();
    expect(transport.getSnapshot().status).toBe('playing');

    const audio = MockAudio.lastInstance()!;
    audio.dispatch('waiting');
    expect(transport.getSnapshot().status).toBe('buffering');

    audio.paused = false;
    audio.dispatch('canplay');
    expect(transport.getSnapshot().status).toBe('playing');
  });

  test('seek clamps to duration and updates position', async () => {
    const transport = createTransport();

    await transport.load({ kind: 'url', url: 'https://example.com/track.mp3' });
    const audio = MockAudio.lastInstance()!;
    audio.duration = 100;

    transport.seek(150);
    expect(transport.getSnapshot().position).toBe(100);
    expect(audio.currentTime).toBe(100);

    transport.seek(-5);
    expect(transport.getSnapshot().position).toBe(0);
    expect(audio.currentTime).toBe(0);
  });

  test('media error codes map to localized messages', async () => {
    const transport = createTransport();
    const errors: string[] = [];
    transport.subscribe('error', (message) => errors.push(message));

    await transport.load({ kind: 'url', url: 'https://example.com/track.mp3' });
    const audio = MockAudio.lastInstance()!;

    for (const [code, message] of Object.entries(MEDIA_ERROR_MESSAGES)) {
      audio.error = { code: Number(code) };
      audio.dispatch('error');
      expect(errors.at(-1)).toBe(message);
    }
  });
});
