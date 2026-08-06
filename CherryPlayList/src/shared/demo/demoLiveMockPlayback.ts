import type { Track } from '@core/types/track';

import { isDemoLiveMode } from '../platform/demoLiveMode';
import { usePlayerAudioStore } from '../stores/playerAudioStore';

const TICK_MS = 500;
const FALLBACK_DURATION_SEC = 180;

let tickerId: ReturnType<typeof setInterval> | null = null;
let tickOriginMs = 0;
let positionAtTickOrigin = 0;

export function isDemoLiveMockPlaybackEnabled(): boolean {
  return isDemoLiveMode();
}

function clearTicker(): void {
  if (tickerId !== null) {
    clearInterval(tickerId);
    tickerId = null;
  }
}

function resolveDuration(track: Track): number {
  const duration = track.duration;
  if (typeof duration === 'number' && Number.isFinite(duration) && duration > 0) {
    return duration;
  }
  return FALLBACK_DURATION_SEC;
}

function startTicker(): void {
  clearTicker();
  positionAtTickOrigin = usePlayerAudioStore.getState().position;
  tickOriginMs = Date.now();

  tickerId = setInterval(() => {
    const store = usePlayerAudioStore.getState();
    if (store.status !== 'playing') {
      return;
    }

    const elapsedSec = (Date.now() - tickOriginMs) / 1000;
    const nextPosition = positionAtTickOrigin + elapsedSec;
    const duration = store.duration;

    if (duration > 0 && nextPosition >= duration) {
      clearTicker();
      store.handleEnded();
      return;
    }

    store.setPosition(nextPosition);
  }, TICK_MS);
}

export function stopDemoLiveMockPlayback(): void {
  clearTicker();
}

export function loadDemoLiveMockTrack(track: Track): void {
  clearTicker();
  usePlayerAudioStore.setState({
    currentTrack: { ...track, isMissing: false },
    status: 'paused',
    position: 0,
    duration: resolveDuration(track),
    error: null,
  });
}

export function playDemoLiveMockPlayback(): void {
  const { currentTrack } = usePlayerAudioStore.getState();
  if (!currentTrack) {
    return;
  }

  usePlayerAudioStore.setState({ status: 'playing', error: null });
  startTicker();
}

export function startDemoLiveMockPlayback(track: Track): void {
  loadDemoLiveMockTrack(track);
  playDemoLiveMockPlayback();
}

export function pauseDemoLiveMockPlayback(): void {
  clearTicker();
  const { status } = usePlayerAudioStore.getState();
  if (status === 'playing') {
    usePlayerAudioStore.setState({ status: 'paused' });
  }
}

export function seekDemoLiveMockPlayback(positionSeconds: number): void {
  const { currentTrack, duration, status } = usePlayerAudioStore.getState();
  if (!currentTrack) {
    return;
  }

  const clamped =
    duration > 0 ? Math.min(Math.max(0, positionSeconds), duration) : Math.max(0, positionSeconds);

  usePlayerAudioStore.setState({
    position: clamped,
    status: status === 'ended' ? 'paused' : status,
  });

  if (status === 'playing') {
    startTicker();
  }
}
