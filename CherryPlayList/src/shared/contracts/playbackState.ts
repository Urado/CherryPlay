import type { StorePlaybackStatus } from '../audio/playback/bindPlaybackEngineToStore';

import type { AimpPlaybackStatus } from './aimp';

/**
 * Playback status on the wire (REST / SignalR).
 * Matches CONTRACTS.md §6.3 and server `PlaybackStatus` enum.
 */
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

/**
 * Maps local player store statuses to the wire contract.
 * Transitional statuses (`loading`, `buffering`) are published as `playing`.
 */
export function mapStoreStatusToWireStatus(status: StorePlaybackStatus): PlaybackWireStatus {
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
}

/** Maps AIMP playback snapshot status to the wire contract. */
export function mapAimpPlaybackStatusToWireStatus(
  status: AimpPlaybackStatus | null | undefined,
): PlaybackWireStatus {
  switch (status) {
    case 'playing':
      return 'playing';
    case 'paused':
      return 'paused';
    case 'stopped':
    default:
      return 'idle';
  }
}
