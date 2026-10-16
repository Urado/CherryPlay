import type { AimpPlaybackStatus } from './aimp';
import type { StorePlaybackStatus } from './storePlaybackStatus';

export type PlaybackWireStatus = 'idle' | 'playing' | 'paused' | 'ended';

export interface PlaybackStateDto {
  currentTrackId: string | null;
  status: PlaybackWireStatus;
  position: number;
  duration: number;
  volume: number;
  mode: 'preparation' | 'session';
  playedTrackIds: string[];
  disabledTrackIds: string[];
  disabledGroupIds: string[];
  lastUpdatedAt: string;
}

export const mapStoreStatusToWireStatus = (status: StorePlaybackStatus): PlaybackWireStatus => {
  switch (status) {
    case 'playing':
    case 'loading':
    case 'buffering':
      return 'playing';
    case 'paused':
      return 'paused';
    case 'ended':
      return 'ended';
    case 'error':
    case 'idle':
    default:
      return 'idle';
  }
};

export const mapAimpPlaybackStatusToWireStatus = (
  status: AimpPlaybackStatus | null | undefined,
): PlaybackWireStatus => {
  switch (status) {
    case 'playing':
      return 'playing';
    case 'paused':
      return 'paused';
    case 'stopped':
    default:
      return 'idle';
  }
};
