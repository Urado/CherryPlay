import { logger } from '../../utils/logger';

import { clampPlaybackValue } from './clampPlaybackValue';
import {
  AUTO_GAIN_NORMALIZATION,
  DEFAULT_EQUALIZER_BANDS,
  DEFAULT_TRACK_GAIN,
  TRACK_GAIN_LINEAR_MAX,
  TRACK_GAIN_LINEAR_MIN,
  type EqualizerBands,
  type PlaybackEffects,
} from './effects';
import type {
  PlaybackEngineEventName,
  PlaybackEngineListener,
  PlaybackEngineSubscription,
} from './events';
import { MediaElementTransport } from './mediaElementTransport';
import type { PlatformAudioAdapter } from './PlatformAudioAdapter';
import type { PlaybackEngine } from './PlaybackEngine';
import type { PlaybackSnapshot, PlaybackSource } from './types';

export interface WebAudioPlaybackEngineOptions {
  readonly id: string;
  readonly initialVolume?: number;
  readonly adapter: PlatformAudioAdapter;
}

/**
 * {@link PlaybackEngine} using Web Audio API (EBU order): MediaElementSource → EQ → compressor →
 * track gain (R128 linear normalize) → master gain → destination.
 *
 * Transport lifecycle (load/play/seek/events) is delegated to {@link MediaElementTransport}.
 */
export class WebAudioPlaybackEngine implements PlaybackEngine, PlaybackEffects {
  private readonly adapter: PlatformAudioAdapter;
  private readonly transport: MediaElementTransport;
  private audioContext: AudioContext | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private trackGainNode: GainNode | null = null;
  private eqLowNode: BiquadFilterNode | null = null;
  private eqMidNode: BiquadFilterNode | null = null;
  private eqHighNode: BiquadFilterNode | null = null;
  private compressorNode: DynamicsCompressorNode | null = null;
  private masterGainNode: GainNode | null = null;
  private trackGain = DEFAULT_TRACK_GAIN;
  private equalizerBands: EqualizerBands = DEFAULT_EQUALIZER_BANDS;
  private autoGainEnabled = false;
  private compressionStrength = 0;

  constructor(options: WebAudioPlaybackEngineOptions) {
    this.adapter = options.adapter;
    this.transport = new MediaElementTransport({
      id: options.id,
      adapter: options.adapter,
      initialVolume: options.initialVolume,
      hooks: {
        applyVolume: (volume) => this.applyMasterVolume(volume),
        applyOutputDevice: (deviceId) => this.applyOutputDevice(deviceId),
        beforePlay: () => this.ensureAudioContextRunning(),
        onDispose: () => {
          this.disconnectGraph();
          void this.audioContext?.close();
          this.audioContext = null;
        },
      },
    });
  }

  get id(): string {
    return this.transport.id;
  }

  load(source: PlaybackSource): Promise<void> {
    return this.transport.load(source);
  }

  play(): Promise<void> {
    return this.transport.play();
  }

  pause(): void {
    this.transport.pause();
  }

  stop(): void {
    this.transport.stop();
  }

  seek(seconds: number): void {
    this.transport.seek(seconds);
  }

  setVolume(value: number): void {
    this.transport.setVolume(value);
  }

  setTrackGain(gain: number): void {
    if (this.transport.isDisposed()) {
      return;
    }

    this.trackGain = clampPlaybackValue(gain, TRACK_GAIN_LINEAR_MIN, TRACK_GAIN_LINEAR_MAX);
    this.applyTrackGain();
  }

  setEqualizerBands(bands: EqualizerBands): void {
    if (this.transport.isDisposed()) {
      return;
    }

    this.equalizerBands = bands;
    this.applyEqualizerBands();
  }

  setAutoGainEnabled(enabled: boolean): void {
    if (this.transport.isDisposed()) {
      return;
    }

    this.autoGainEnabled = enabled;
    this.applyTrackGain();
  }

  setCompressionStrength(strength: number): void {
    if (this.transport.isDisposed()) {
      return;
    }

    this.compressionStrength = clampPlaybackValue(strength, 0, 1);
    this.applyCompressionParams();
    this.applyCompressionRouting();
  }

  setOutputDevice(deviceId: string | null): Promise<void> {
    return this.transport.setOutputDevice(deviceId);
  }

  getSnapshot(): PlaybackSnapshot {
    return this.transport.getSnapshot();
  }

  subscribe<K extends PlaybackEngineEventName>(
    event: K,
    listener: PlaybackEngineListener<K>,
  ): PlaybackEngineSubscription {
    return this.transport.subscribe(event, listener);
  }

  dispose(): void {
    this.transport.dispose();
  }

  private async ensureAudioContextRunning(): Promise<void> {
    this.ensureGraph();
    if (this.audioContext?.state === 'suspended') {
      await this.audioContext.resume();
    }
  }

  private ensureGraph(): void {
    if (this.audioContext && this.sourceNode) {
      return;
    }

    const audio = this.transport.getAudioElement();
    const context = new AudioContext();
    const sourceNode = context.createMediaElementSource(audio);
    const trackGainNode = context.createGain();
    const eqLowNode = context.createBiquadFilter();
    eqLowNode.type = 'lowshelf';
    eqLowNode.frequency.value = 320;

    const eqMidNode = context.createBiquadFilter();
    eqMidNode.type = 'peaking';
    eqMidNode.frequency.value = 1000;
    eqMidNode.Q.value = 1;

    const eqHighNode = context.createBiquadFilter();
    eqHighNode.type = 'highshelf';
    eqHighNode.frequency.value = 3200;

    const compressorNode = context.createDynamicsCompressor();
    compressorNode.attack.value = 0.015;
    compressorNode.release.value = 1;

    const masterGainNode = context.createGain();

    sourceNode.connect(eqLowNode);
    eqLowNode.connect(eqMidNode);
    eqMidNode.connect(eqHighNode);

    this.audioContext = context;
    this.sourceNode = sourceNode;
    this.trackGainNode = trackGainNode;
    this.eqLowNode = eqLowNode;
    this.eqMidNode = eqMidNode;
    this.eqHighNode = eqHighNode;
    this.compressorNode = compressorNode;
    this.masterGainNode = masterGainNode;

    this.applyCompressionParams();
    this.applyCompressionRouting();
    masterGainNode.connect(context.destination);

    this.applyTrackGain();
    this.applyEqualizerBands();
    this.applyMasterVolume(this.transport.getSnapshot().volume);

    if ('setSinkId' in context && typeof context.setSinkId === 'function') {
      const outputDeviceId = this.transport.getSnapshot().outputDeviceId;
      void context.setSinkId(outputDeviceId ?? 'default').catch((error: unknown) => {
        logger.warn(
          'WebAudioPlaybackEngine: failed to set AudioContext sink on graph init',
          error instanceof Error ? error : undefined,
        );
      });
    }
  }

  /**
   * Routes output to the selected device. After {@link createMediaElementSource},
   * Chromium/Electron reject {@link HTMLAudioElement.setSinkId} (AbortError) — use
   * {@link AudioContext.setSinkId} for the Web Audio graph instead.
   */
  private async applyOutputDevice(deviceId: string | null): Promise<void> {
    const sinkId = deviceId ?? 'default';

    if (this.sourceNode !== null || this.audioContext !== null) {
      this.ensureGraph();
      if (
        this.audioContext &&
        'setSinkId' in this.audioContext &&
        typeof this.audioContext.setSinkId === 'function'
      ) {
        await this.audioContext.setSinkId(sinkId);
        return;
      }
    }

    await this.adapter.setSinkId(this.transport.getAudioElement(), deviceId);
  }

  private applyMasterVolume(volume: number): void {
    if (this.masterGainNode) {
      this.masterGainNode.gain.value = volume;
      return;
    }

    if (!this.transport.isDisposed()) {
      this.transport.getAudioElement().volume = volume;
    }
  }

  private applyTrackGain(): void {
    if (!this.trackGainNode) {
      return;
    }

    const autoMultiplier = this.autoGainEnabled ? AUTO_GAIN_NORMALIZATION : 1;
    this.trackGainNode.gain.value = this.trackGain * autoMultiplier;
  }

  private applyEqualizerBands(): void {
    if (this.eqLowNode) {
      this.eqLowNode.gain.value = this.equalizerBands.lowDb;
    }
    if (this.eqMidNode) {
      this.eqMidNode.gain.value = this.equalizerBands.midDb;
    }
    if (this.eqHighNode) {
      this.eqHighNode.gain.value = this.equalizerBands.highDb;
    }
  }

  private applyCompressionParams(): void {
    if (!this.compressorNode) {
      return;
    }

    const strength = this.compressionStrength;
    if (strength <= 0) {
      return;
    }

    // EBU Tech 3343 gentle LRA block: low threshold, moderate ratio, long release.
    this.compressorNode.threshold.value = -45 + strength * 10;
    this.compressorNode.ratio.value = 1.2 + strength * 0.8;
    this.compressorNode.knee.value = 30 - strength * 15;
  }

  private applyCompressionRouting(): void {
    if (!this.eqHighNode || !this.trackGainNode || !this.masterGainNode) {
      return;
    }

    this.eqHighNode.disconnect();
    this.compressorNode?.disconnect();
    this.trackGainNode.disconnect();

    if (this.compressionStrength > 0 && this.compressorNode) {
      this.eqHighNode.connect(this.compressorNode);
      this.compressorNode.connect(this.trackGainNode);
    } else {
      this.eqHighNode.connect(this.trackGainNode);
    }

    this.trackGainNode.connect(this.masterGainNode);
  }

  private disconnectGraph(): void {
    this.sourceNode?.disconnect();
    this.trackGainNode?.disconnect();
    this.eqLowNode?.disconnect();
    this.eqMidNode?.disconnect();
    this.eqHighNode?.disconnect();
    this.compressorNode?.disconnect();
    this.masterGainNode?.disconnect();
    this.sourceNode = null;
    this.trackGainNode = null;
    this.eqLowNode = null;
    this.eqMidNode = null;
    this.eqHighNode = null;
    this.compressorNode = null;
    this.masterGainNode = null;
  }
}
