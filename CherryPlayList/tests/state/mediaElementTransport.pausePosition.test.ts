import { MediaElementTransport } from '../../src/shared/audio/playback/mediaElementTransport';
import type { PlatformAudioAdapter } from '../../src/shared/audio/playback/PlatformAudioAdapter';

describe('MediaElementTransport pause position', () => {
  const originalAudio = global.Audio;

  afterEach(() => {
    global.Audio = originalAudio;
  });

  it('captures the current media position when pausing between timeupdate events', async () => {
    const audio = {
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      pause: jest.fn(),
      play: jest.fn().mockResolvedValue(undefined),
      currentTime: 0,
      duration: 120,
      preload: 'none',
      crossOrigin: '',
      src: '',
    } as unknown as HTMLAudioElement;
    global.Audio = jest.fn(() => audio);

    const adapter: PlatformAudioAdapter = {
      resolveSource: jest.fn().mockResolvedValue({ url: 'audio:test-track' }),
      setSinkId: jest.fn().mockResolvedValue(undefined),
    };
    const transport = new MediaElementTransport({ id: 'test-player', adapter });

    await transport.load({ kind: 'filePath', path: 'track.mp3' });
    await transport.play();
    audio.currentTime = 48.72;

    transport.pause();

    expect(transport.getSnapshot()).toMatchObject({ status: 'paused', position: 48.72 });
    expect(audio.pause).toHaveBeenCalledTimes(2);

    await transport.play();

    expect(transport.getSnapshot()).toMatchObject({ status: 'playing', position: 48.72 });
  });
});
