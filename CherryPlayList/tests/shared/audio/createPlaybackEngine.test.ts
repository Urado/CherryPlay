jest.mock('../../../src/shared/services/ipcService', () => ({
  ipcService: {
    getAudioFileUrl: jest.fn(),
    getAudioDuration: jest.fn(),
  },
}));

import {
  createPlaybackEngine,
  createPlaybackEnginePair,
} from '../../../src/shared/audio/playback/createPlaybackEngine';
import type { PlatformAudioAdapter } from '../../../src/shared/audio/playback/PlatformAudioAdapter';
import {
  DEMO_PLAYBACK_ENGINE_ID,
  MAIN_PLAYBACK_ENGINE_ID,
} from '../../../src/shared/audio/playback/types';

const mockAdapter: PlatformAudioAdapter = {
  resolveSource: jest.fn(async (source) => {
    if (source.kind === 'url') {
      return { url: source.url };
    }
    return { url: 'blob:mock' };
  }),
  setSinkId: jest.fn().mockResolvedValue(undefined),
};

describe('createPlaybackEngine', () => {
  test('returns distinct engine instances on each call', () => {
    const first = createPlaybackEngine({ id: 'instance-a', adapter: mockAdapter });
    const second = createPlaybackEngine({ id: 'instance-b', adapter: mockAdapter });

    expect(first).not.toBe(second);
    expect(first.id).toBe('instance-a');
    expect(second.id).toBe('instance-b');
  });

  test('dispose on one instance does not affect the other', () => {
    const first = createPlaybackEngine({ id: 'instance-a', adapter: mockAdapter });
    const second = createPlaybackEngine({ id: 'instance-b', adapter: mockAdapter });

    const secondStatusListener = jest.fn();
    second.subscribe('statusChanged', secondStatusListener);

    first.dispose();

    expect(first.getSnapshot().status).toBe('idle');
    expect(second.getSnapshot().status).toBe('idle');
    expect(second.id).toBe('instance-b');

    second.setVolume(0.5);
    expect(second.getSnapshot().volume).toBe(0.5);
    expect(secondStatusListener).not.toHaveBeenCalled();
  });

  test('creates WebAudioPlaybackEngine with effects support', () => {
    const engine = createPlaybackEngine({ id: 'test', adapter: mockAdapter });
    expect(engine.id).toBe('test');
    expect(engine.getSnapshot().volume).toBe(0.8);
    expect('setTrackGain' in engine).toBe(true);
  });
});

describe('createPlaybackEnginePair', () => {
  test('yields main and demo instances with distinct ids and objects', () => {
    const pair = createPlaybackEnginePair({ adapter: mockAdapter });

    expect(pair.main.id).toBe(MAIN_PLAYBACK_ENGINE_ID);
    expect(pair.demo.id).toBe(DEMO_PLAYBACK_ENGINE_ID);
    expect(MAIN_PLAYBACK_ENGINE_ID).toBe('main');
    expect(DEMO_PLAYBACK_ENGINE_ID).toBe('demo');
    expect(pair.main).not.toBe(pair.demo);
  });

  test('dispose on main does not affect demo instance', () => {
    const pair = createPlaybackEnginePair({ adapter: mockAdapter });

    pair.main.dispose();
    pair.demo.setVolume(0.25);

    expect(pair.demo.getSnapshot().volume).toBe(0.25);
    expect(pair.demo.id).toBe(DEMO_PLAYBACK_ENGINE_ID);
  });
});
