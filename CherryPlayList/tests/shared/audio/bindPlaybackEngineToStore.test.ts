import {
  bindPlaybackEngineToStore,
  mapEngineStatusToStoreStatus,
} from '../../../src/shared/audio/playback/bindPlaybackEngineToStore';
import type {
  PlaybackEngineEventName,
  PlaybackEngineListener,
  PlaybackEngineSubscription,
} from '../../../src/shared/audio/playback/events';
import type { PlaybackEngine } from '../../../src/shared/audio/playback/PlaybackEngine';
import type { PlaybackSnapshot, PlaybackSource } from '../../../src/shared/audio/playback/types';

type EngineListenerMap = {
  [K in PlaybackEngineEventName]?: Set<PlaybackEngineListener<K>>;
};

class MockPlaybackEngine implements PlaybackEngine {
  readonly id = 'mock';

  private listeners: EngineListenerMap = {};
  private snapshot: PlaybackSnapshot = {
    status: 'idle',
    position: 0,
    duration: 0,
    volume: 0.8,
    outputDeviceId: null,
    error: null,
  };

  load = jest.fn(async (_source: PlaybackSource) => undefined);
  play = jest.fn(async () => undefined);
  pause = jest.fn();
  stop = jest.fn();
  seek = jest.fn();
  setVolume = jest.fn();
  setOutputDevice = jest.fn(async () => undefined);
  dispose = jest.fn();

  getSnapshot(): PlaybackSnapshot {
    return { ...this.snapshot };
  }

  subscribe<K extends PlaybackEngineEventName>(
    event: K,
    listener: PlaybackEngineListener<K>,
  ): PlaybackEngineSubscription {
    if (!this.listeners[event]) {
      this.listeners[event] = new Set();
    }
    this.listeners[event]!.add(listener as PlaybackEngineListener<PlaybackEngineEventName>);

    return () => {
      this.listeners[event]?.delete(listener as PlaybackEngineListener<PlaybackEngineEventName>);
    };
  }

  emit<K extends PlaybackEngineEventName>(
    event: K,
    payload: Parameters<PlaybackEngineListener<K>>[0],
  ): void {
    const eventListeners = this.listeners[event];
    if (!eventListeners) {
      return;
    }

    for (const listener of eventListeners) {
      (listener as PlaybackEngineListener<K>)(payload);
    }
  }
}

describe('mapEngineStatusToStoreStatus', () => {
  it('maps engine statuses 1:1 including error', () => {
    expect(mapEngineStatusToStoreStatus('playing')).toBe('playing');
    expect(mapEngineStatusToStoreStatus('paused')).toBe('paused');
    expect(mapEngineStatusToStoreStatus('loading')).toBe('loading');
    expect(mapEngineStatusToStoreStatus('buffering')).toBe('buffering');
    expect(mapEngineStatusToStoreStatus('ended')).toBe('ended');
    expect(mapEngineStatusToStoreStatus('error')).toBe('error');
    expect(mapEngineStatusToStoreStatus('idle')).toBe('idle');
  });
});

describe('bindPlaybackEngineToStore', () => {
  it('wires status, position, duration, ended, and error callbacks', () => {
    const engine = new MockPlaybackEngine();
    const onStatusChanged = jest.fn();
    const onPositionChanged = jest.fn();
    const onDurationChanged = jest.fn();
    const onEnded = jest.fn();
    const onError = jest.fn();

    bindPlaybackEngineToStore(engine, {
      onStatusChanged,
      onPositionChanged,
      onDurationChanged,
      onEnded,
      onError,
    });

    engine.emit('statusChanged', 'error');
    engine.emit('positionChanged', 12);
    engine.emit('durationChanged', 180);
    engine.emit('ended', undefined);
    engine.emit('error', 'playback failed');

    expect(onStatusChanged).toHaveBeenCalledWith('error');
    expect(onPositionChanged).toHaveBeenCalledWith(12);
    expect(onDurationChanged).toHaveBeenCalledWith(180);
    expect(onEnded).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith('playback failed');
  });

  it('invokes onError once when play fails through engine error event', async () => {
    const engine = new MockPlaybackEngine();
    const onError = jest.fn();
    const handleError = jest.fn();

    bindPlaybackEngineToStore(engine, {
      onStatusChanged: jest.fn(),
      onPositionChanged: jest.fn(),
      onDurationChanged: jest.fn(),
      onEnded: jest.fn(),
      onError: (message) => {
        onError(message);
        handleError(message);
      },
    });

    engine.play.mockRejectedValueOnce(new Error('blocked'));

    await expect(engine.play()).rejects.toThrow('blocked');
    engine.emit('error', 'blocked');

    expect(onError).toHaveBeenCalledTimes(1);
    expect(handleError).toHaveBeenCalledTimes(1);
    expect(handleError).toHaveBeenCalledWith('blocked');
  });
});
