import { clampPlaybackValue } from './clampPlaybackValue';
import type {
  PlaybackEngineEventName,
  PlaybackEngineListener,
  PlaybackEngineSubscription,
} from './events';
import type { PlatformAudioAdapter } from './PlatformAudioAdapter';
import type { PlaybackEngineStatus, PlaybackSnapshot, PlaybackSource } from './types';
import { DEFAULT_PLAYBACK_VOLUME } from './types';

export const MEDIA_ERROR_MESSAGES: Record<number, string> = {
  1: 'Воспроизведение прервано системой',
  2: 'Ошибка сети при воспроизведении',
  3: 'Невозможно декодировать аудио',
  4: 'Файл не найден или формат не поддерживается',
};

export interface MediaElementTransportHooks {
  applyVolume?: (volume: number, audio: HTMLAudioElement) => void;
  applyOutputDevice?: (deviceId: string | null, audio: HTMLAudioElement) => Promise<void>;
  beforePlay?: () => Promise<void>;
  onDispose?: () => void;
}

export interface MediaElementTransportOptions {
  readonly id: string;
  readonly adapter: PlatformAudioAdapter;
  readonly initialVolume?: number;
  readonly hooks?: MediaElementTransportHooks;
}

type EventHandlers = {
  ended?: () => void;
  timeupdate?: () => void;
  seeking?: () => void;
  seeked?: () => void;
  loadedmetadata?: () => void;
  error?: () => void;
  pause?: () => void;
  play?: () => void;
  waiting?: () => void;
  stalled?: () => void;
  canplay?: () => void;
  canplaythrough?: () => void;
};

/**
 * Shared HTMLAudioElement transport: snapshot, events, load/play/pause/seek lifecycle.
 * Used by {@link WebAudioPlaybackEngine}; backend-specific routing via hooks.
 */
export class MediaElementTransport {
  readonly id: string;

  private readonly adapter: PlatformAudioAdapter;
  private readonly hooks: MediaElementTransportHooks;
  private audioElement: HTMLAudioElement | null = null;
  private revokeCurrentUrl: (() => void) | null = null;
  private disposed = false;
  private snapshot: PlaybackSnapshot;
  private readonly listeners = new Map<
    PlaybackEngineEventName,
    Set<PlaybackEngineListener<PlaybackEngineEventName>>
  >();
  private eventHandlers: EventHandlers = {};
  private seekInProgress = false;

  constructor(options: MediaElementTransportOptions) {
    this.id = options.id;
    this.adapter = options.adapter;
    this.hooks = options.hooks ?? {};
    const volume = options.initialVolume ?? DEFAULT_PLAYBACK_VOLUME;
    this.snapshot = {
      status: 'idle',
      position: 0,
      duration: 0,
      volume,
      outputDeviceId: null,
      error: null,
    };
  }

  isDisposed(): boolean {
    return this.disposed;
  }

  async load(source: PlaybackSource): Promise<void> {
    if (this.disposed) {
      return;
    }

    this.setStatus('loading');

    try {
      const audio = this.getAudioElement();
      audio.pause();

      const resolved = await this.adapter.resolveSource(source);
      if (this.disposed) {
        return;
      }

      this.revokeResolvedUrl();
      this.revokeCurrentUrl = resolved.revoke ?? null;

      audio.src = resolved.url;
      audio.currentTime = 0;
      this.hooks.applyVolume?.(this.snapshot.volume, audio);

      const applyOutputDevice =
        this.hooks.applyOutputDevice ??
        (async (deviceId, element) => {
          await this.adapter.setSinkId(element, deviceId);
        });
      await applyOutputDevice(this.snapshot.outputDeviceId, audio);
      if (this.disposed) {
        return;
      }

      if (source.kind === 'filePath' && this.adapter.getDuration) {
        const duration = await this.adapter.getDuration(source.path);
        if (this.disposed) {
          return;
        }
        if (duration !== null && duration > 0) {
          this.updateDuration(duration);
        }
      }

      this.updatePosition(0);
      this.setError(null);
      this.setStatus('paused');
    } catch (error) {
      if (this.disposed) {
        return;
      }
      const message =
        error instanceof Error ? error.message : 'Не удалось загрузить файл для воспроизведения';
      this.handlePlaybackError(message);
      throw error instanceof Error ? error : new Error(message);
    }
  }

  async play(): Promise<void> {
    if (this.disposed || !this.audioElement?.src) {
      return;
    }

    try {
      await this.hooks.beforePlay?.();
      if (this.disposed) {
        return;
      }

      await this.audioElement.play();
      if (this.disposed) {
        return;
      }
      this.setError(null);
      this.setStatus('playing');
    } catch (error) {
      if (this.disposed) {
        return;
      }
      const message = error instanceof Error ? error.message : 'Не удалось воспроизвести трек';
      this.handlePlaybackError(message);
      throw error instanceof Error ? error : new Error(message);
    }
  }

  pause(): void {
    if (this.disposed || !this.audioElement) {
      return;
    }

    this.audioElement.pause();
    if (this.snapshot.status === 'playing') {
      this.setStatus('paused');
    }
  }

  stop(): void {
    if (this.disposed || !this.audioElement) {
      return;
    }

    this.audioElement.pause();
    this.audioElement.currentTime = 0;
    this.updatePosition(0);
    this.setError(null);
    this.setStatus('idle');
  }

  seek(seconds: number): void {
    if (this.disposed) {
      return;
    }

    const audio = this.getAudioElement();
    const effectiveDuration = this.snapshot.duration || audio.duration || 0;
    const clamped =
      effectiveDuration > 0
        ? clampPlaybackValue(seconds, 0, effectiveDuration)
        : Math.max(0, seconds);

    this.seekInProgress = true;
    this.updatePosition(clamped);

    if (typeof audio.fastSeek === 'function') {
      audio.fastSeek(clamped);
    } else {
      audio.currentTime = clamped;
    }

    if (this.snapshot.status === 'ended') {
      this.setStatus('paused');
    }
  }

  setVolume(value: number): void {
    if (this.disposed) {
      return;
    }

    const safeValue = clampPlaybackValue(value, 0, 1);
    this.snapshot = { ...this.snapshot, volume: safeValue };
    this.hooks.applyVolume?.(safeValue, this.getAudioElement());
  }

  async setOutputDevice(deviceId: string | null): Promise<void> {
    if (this.disposed) {
      return;
    }

    const applyOutputDevice =
      this.hooks.applyOutputDevice ??
      (async (id, element) => {
        await this.adapter.setSinkId(element, id);
      });
    await applyOutputDevice(deviceId, this.getAudioElement());
    if (this.disposed) {
      return;
    }

    this.snapshot = { ...this.snapshot, outputDeviceId: deviceId };
    this.emit('outputDeviceChanged', deviceId);
  }

  getSnapshot(): PlaybackSnapshot {
    return { ...this.snapshot };
  }

  subscribe<K extends PlaybackEngineEventName>(
    event: K,
    listener: PlaybackEngineListener<K>,
  ): PlaybackEngineSubscription {
    let eventListeners = this.listeners.get(event);
    if (!eventListeners) {
      eventListeners = new Set();
      this.listeners.set(event, eventListeners);
    }

    eventListeners.add(listener as PlaybackEngineListener<PlaybackEngineEventName>);

    let active = true;
    return () => {
      if (!active) {
        return;
      }
      active = false;
      eventListeners?.delete(listener as PlaybackEngineListener<PlaybackEngineEventName>);
    };
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    this.hooks.onDispose?.();
    this.cleanupAudioElement();
    this.revokeResolvedUrl();
    this.listeners.clear();
  }

  getAudioElement(): HTMLAudioElement {
    if (!this.audioElement) {
      const audioElement = new Audio();
      audioElement.preload = 'auto';
      audioElement.crossOrigin = 'anonymous';

      this.eventHandlers.ended = () => {
        this.setStatus('ended');
        this.emit('ended', undefined);
      };
      this.eventHandlers.timeupdate = () => {
        if (this.seekInProgress) {
          return;
        }
        this.updatePosition(audioElement.currentTime);
      };
      this.eventHandlers.seeking = () => {
        this.seekInProgress = true;
      };
      this.eventHandlers.seeked = () => {
        this.seekInProgress = false;
        this.updatePosition(audioElement.currentTime);
      };
      this.eventHandlers.loadedmetadata = () => {
        const duration = audioElement.duration;
        if (Number.isFinite(duration)) {
          this.updateDuration(duration);
        }
      };
      this.eventHandlers.error = () => {
        const mediaError = audioElement.error;
        const code = mediaError?.code;
        const message =
          (code && MEDIA_ERROR_MESSAGES[code]) ||
          'Не удалось воспроизвести трек. Проверьте файл и попробуйте снова.';
        this.handlePlaybackError(message);
      };
      this.eventHandlers.pause = () => {
        if (this.snapshot.status === 'playing') {
          this.setStatus('paused');
        }
      };
      this.eventHandlers.play = () => {
        if (
          this.snapshot.status === 'paused' ||
          this.snapshot.status === 'idle' ||
          this.snapshot.status === 'buffering'
        ) {
          this.setError(null);
          this.setStatus('playing');
        }
      };
      this.eventHandlers.waiting = () => {
        if (this.snapshot.status === 'playing') {
          this.setStatus('buffering');
        }
      };
      this.eventHandlers.stalled = () => {
        if (this.snapshot.status === 'playing') {
          this.setStatus('buffering');
        }
      };
      this.eventHandlers.canplay = () => {
        this.resumeFromBuffering();
      };
      this.eventHandlers.canplaythrough = () => {
        this.resumeFromBuffering();
      };

      audioElement.addEventListener('ended', this.eventHandlers.ended);
      audioElement.addEventListener('timeupdate', this.eventHandlers.timeupdate);
      audioElement.addEventListener('seeking', this.eventHandlers.seeking);
      audioElement.addEventListener('seeked', this.eventHandlers.seeked);
      audioElement.addEventListener('loadedmetadata', this.eventHandlers.loadedmetadata);
      audioElement.addEventListener('error', this.eventHandlers.error);
      audioElement.addEventListener('pause', this.eventHandlers.pause);
      audioElement.addEventListener('play', this.eventHandlers.play);
      audioElement.addEventListener('waiting', this.eventHandlers.waiting);
      audioElement.addEventListener('stalled', this.eventHandlers.stalled);
      audioElement.addEventListener('canplay', this.eventHandlers.canplay);
      audioElement.addEventListener('canplaythrough', this.eventHandlers.canplaythrough);

      this.audioElement = audioElement;
      this.hooks.applyVolume?.(this.snapshot.volume, audioElement);
    }

    return this.audioElement;
  }

  private cleanupAudioElement(): void {
    if (!this.audioElement) {
      return;
    }

    const {
      ended,
      timeupdate,
      seeking,
      seeked,
      loadedmetadata,
      error,
      pause,
      play,
      waiting,
      stalled,
      canplay,
      canplaythrough,
    } = this.eventHandlers;
    if (ended) {
      this.audioElement.removeEventListener('ended', ended);
    }
    if (timeupdate) {
      this.audioElement.removeEventListener('timeupdate', timeupdate);
    }
    if (seeking) {
      this.audioElement.removeEventListener('seeking', seeking);
    }
    if (seeked) {
      this.audioElement.removeEventListener('seeked', seeked);
    }
    if (loadedmetadata) {
      this.audioElement.removeEventListener('loadedmetadata', loadedmetadata);
    }
    if (error) {
      this.audioElement.removeEventListener('error', error);
    }
    if (pause) {
      this.audioElement.removeEventListener('pause', pause);
    }
    if (play) {
      this.audioElement.removeEventListener('play', play);
    }
    if (waiting) {
      this.audioElement.removeEventListener('waiting', waiting);
    }
    if (stalled) {
      this.audioElement.removeEventListener('stalled', stalled);
    }
    if (canplay) {
      this.audioElement.removeEventListener('canplay', canplay);
    }
    if (canplaythrough) {
      this.audioElement.removeEventListener('canplaythrough', canplaythrough);
    }

    this.eventHandlers = {};
    this.audioElement.pause();
    this.audioElement.src = '';
    this.audioElement.currentTime = 0;
    this.audioElement = null;
  }

  private revokeResolvedUrl(): void {
    if (this.revokeCurrentUrl) {
      this.revokeCurrentUrl();
      this.revokeCurrentUrl = null;
    }
  }

  private setStatus(status: PlaybackEngineStatus): void {
    if (this.snapshot.status === status) {
      return;
    }
    this.snapshot = { ...this.snapshot, status };
    this.emit('statusChanged', status);
  }

  private updatePosition(position: number): void {
    if (this.snapshot.position === position) {
      return;
    }
    this.snapshot = { ...this.snapshot, position };
    this.emit('positionChanged', position);
  }

  private updateDuration(duration: number): void {
    if (this.snapshot.duration === duration) {
      return;
    }
    this.snapshot = { ...this.snapshot, duration };
    this.emit('durationChanged', duration);
  }

  private setError(error: string | null): void {
    this.snapshot = { ...this.snapshot, error };
  }

  private resumeFromBuffering(): void {
    if (this.snapshot.status !== 'buffering' || !this.audioElement) {
      return;
    }

    if (this.audioElement.paused) {
      this.setStatus('paused');
      return;
    }

    this.setStatus('playing');
  }

  private handlePlaybackError(message: string): void {
    const shouldEmitError = this.snapshot.status !== 'error' || this.snapshot.error !== message;
    this.setError(message);
    this.setStatus('error');
    if (shouldEmitError) {
      this.emit('error', message);
    }
  }

  private emit<K extends PlaybackEngineEventName>(
    event: K,
    payload: Parameters<PlaybackEngineListener<K>>[0],
  ): void {
    const eventListeners = this.listeners.get(event);
    if (!eventListeners) {
      return;
    }

    for (const listener of eventListeners) {
      (listener as PlaybackEngineListener<K>)(payload);
    }
  }
}
