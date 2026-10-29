import type { Track } from '../../../src/core/types/track';
import { applyPlaybackEffects } from '../../../src/shared/audio/playback/applyPlaybackEffects';
import type { PlaybackEngine } from '../../../src/shared/audio/playback/PlaybackEngine';
import type { PlaybackSnapshot, PlaybackSource } from '../../../src/shared/audio/playback/types';
import {
  createHandleError,
  loadTrackCore,
  wirePlaybackEngine,
} from '../../../src/shared/stores/playbackStoreCore';

jest.mock('../../../src/shared/platform/appMode', () => ({
  getAppMode: jest.fn(() => 'electron'),
}));

jest.mock('../../../src/shared/audio/playback/applyPlaybackEffects', () => ({
  applyPlaybackEffects: jest.fn(),
}));

jest.mock('../../../src/shared/audio/playback/applyPlaybackOutputDeviceWithFallback', () => ({
  applyPlaybackOutputDeviceWithFallback: jest.fn(() => Promise.resolve()),
}));

const mockLoudnessSettings = {
  loudnessNormalizationEnabled: true,
  loudnessTargetLufs: -18,
  loudnessCompressionEnabled: false,
  loudnessQuietGapRangeLu: 15,
};

jest.mock('../../../src/shared/stores/settingsStore', () => ({
  useSettingsStore: {
    subscribe: () => () => undefined,
    getState: () => mockLoudnessSettings,
  },
}));

const mockedApplyPlaybackEffects = applyPlaybackEffects as jest.MockedFunction<
  typeof applyPlaybackEffects
>;

const baseTrack: Track = {
  id: 'track-1',
  name: 'Test Track',
  path: '/music/test.mp3',
  duration: 120,
  isMissing: false,
};

const createMockEngine = (): PlaybackEngine & {
  emitStatus: (status: PlaybackSnapshot['status']) => void;
} => {
  let status: PlaybackSnapshot['status'] = 'idle';
  const statusListeners = new Set<(value: PlaybackSnapshot['status']) => void>();

  const engine: PlaybackEngine & { emitStatus: (status: PlaybackSnapshot['status']) => void } = {
    id: 'mock',
    load: jest.fn(() => Promise.resolve()),
    play: jest.fn(() => Promise.resolve()),
    pause: jest.fn(),
    stop: jest.fn(() => {
      status = 'idle';
      for (const listener of statusListeners) {
        listener('idle');
      }
    }),
    seek: jest.fn(),
    setVolume: jest.fn(),
    setOutputDevice: jest.fn(() => Promise.resolve()),
    dispose: jest.fn(),
    getSnapshot: () => ({
      status,
      position: 0,
      duration: 0,
      volume: 0.8,
      outputDeviceId: null,
      error: null,
    }),
    subscribe: (event, listener) => {
      if (event === 'statusChanged') {
        statusListeners.add(listener as (value: PlaybackSnapshot['status']) => void);
      }
      return () => {
        statusListeners.delete(listener as (value: PlaybackSnapshot['status']) => void);
      };
    },
    emitStatus: (nextStatus) => {
      status = nextStatus;
      for (const listener of statusListeners) {
        listener(nextStatus);
      }
    },
  };

  return engine;
};

describe('createHandleError', () => {
  it('sets error state before stop and ignores idle status from stop', () => {
    const engine = createMockEngine();
    const stopMock = jest.spyOn(engine, 'stop');
    const calls: string[] = [];
    let storeStatus = 'playing';

    const handleError = createHandleError({
      engine,
      logLabel: 'Test player',
      setErrorState: (message) => {
        calls.push(`error:${message}`);
        storeStatus = 'error';
      },
    });

    wirePlaybackEngine({
      engine,
      getStatus: () => storeStatus,
      setStatus: (status) => {
        calls.push(`status:${status}`);
        storeStatus = status;
      },
      setPosition: jest.fn(),
      setDuration: jest.fn(),
      handleEnded: jest.fn(),
      handleError: (message) => handleError(message),
      getDeviceId: () => null,
      selectSettingsDeviceId: () => null,
      onDeviceNotFound: jest.fn(),
      onSettingsDeviceChange: jest.fn(),
      initLogContext: 'test',
      initErrorLogLabel: 'test',
    });

    handleError('playback failed');

    expect(calls).toEqual(['error:playback failed']);
    expect(storeStatus).toBe('error');
    expect(stopMock).toHaveBeenCalledTimes(1);
  });
});

describe('loadTrackCore', () => {
  beforeEach(() => {
    mockedApplyPlaybackEffects.mockClear();
  });

  it('applies playback effects after a successful engine load', async () => {
    const engine = createMockEngine();
    const loadMock = jest.spyOn(engine, 'load');

    await loadTrackCore({
      engine,
      track: baseTrack,
      applyDevice: jest.fn(() => Promise.resolve()),
      getDeviceId: () => null,
      markTrackFound: jest.fn(),
      resolvePrecheck: (track) => Promise.resolve(track),
      onSuccess: jest.fn(),
      onFileNotFound: jest.fn(),
    });

    expect(loadMock).toHaveBeenCalledWith({ kind: 'filePath', path: baseTrack.path });
    expect(mockedApplyPlaybackEffects).toHaveBeenCalledTimes(1);
    expect(mockedApplyPlaybackEffects).toHaveBeenCalledWith(
      engine,
      baseTrack,
      mockLoudnessSettings,
    );
  });

  it('does not apply effects when engine load fails', async () => {
    const engine = createMockEngine();
    engine.load = jest.fn((_source: PlaybackSource) => Promise.reject(new Error('decode failed')));

    await expect(
      loadTrackCore({
        engine,
        track: baseTrack,
        applyDevice: jest.fn(() => Promise.resolve()),
        getDeviceId: () => null,
        markTrackFound: jest.fn(),
        resolvePrecheck: (track) => Promise.resolve(track),
        onSuccess: jest.fn(),
        onFileNotFound: jest.fn(),
      }),
    ).rejects.toThrow('decode failed');

    expect(mockedApplyPlaybackEffects).not.toHaveBeenCalled();
  });
});
