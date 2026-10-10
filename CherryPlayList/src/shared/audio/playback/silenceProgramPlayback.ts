import type { ProgramPlayableItem } from '@core/types/project';
import { isEmptyTrack } from '@core/types/project';

const TICK_MS = 250;

let tickerId: ReturnType<typeof setInterval> | null = null;
let tickOriginMs = 0;
let positionAtTickOrigin = 0;

type SilencePlaybackHandlers = {
  getState: () => {
    status: string;
    position: number;
    duration: number;
    currentTrack: ProgramPlayableItem | null;
  };
  setPosition: (positionSeconds: number) => void;
  handleEnded: () => void;
};

let handlers: SilencePlaybackHandlers | null = null;

function clearTicker(): void {
  if (tickerId !== null) {
    clearInterval(tickerId);
    tickerId = null;
  }
}

function startTicker(): void {
  if (!handlers) {
    return;
  }
  clearTicker();
  positionAtTickOrigin = handlers.getState().position;
  tickOriginMs = Date.now();

  tickerId = setInterval(() => {
    if (!handlers) {
      return;
    }
    const state = handlers.getState();
    if (state.status !== 'playing') {
      return;
    }
    const elapsedSec = (Date.now() - tickOriginMs) / 1000;
    const nextPosition = positionAtTickOrigin + elapsedSec;
    const trackDuration = state.duration;
    if (trackDuration > 0 && nextPosition >= trackDuration) {
      clearTicker();
      handlers.setPosition(trackDuration);
      handlers.handleEnded();
      return;
    }
    handlers.setPosition(nextPosition);
  }, TICK_MS);
}

export function isSilenceProgramPlaybackTrack(
  track: ProgramPlayableItem | null | undefined,
): boolean {
  return track != null && isEmptyTrack(track);
}

export function wireSilenceProgramPlayback(nextHandlers: SilencePlaybackHandlers): void {
  handlers = nextHandlers;
}

export function stopSilenceProgramPlayback(): void {
  clearTicker();
}

export function loadSilenceProgramTrack(track: ProgramPlayableItem): void {
  clearTicker();
}

export function playSilenceProgramPlayback(): void {
  startTicker();
}

export function pauseSilenceProgramPlayback(): void {
  clearTicker();
}

export function seekSilenceProgramPlayback(positionSeconds: number, duration: number): number {
  const clamped =
    duration > 0 ? Math.min(Math.max(0, positionSeconds), duration) : Math.max(0, positionSeconds);
  positionAtTickOrigin = clamped;
  tickOriginMs = Date.now();
  const state = handlers?.getState();
  if (state?.status === 'playing') {
    startTicker();
  }
  return clamped;
}
