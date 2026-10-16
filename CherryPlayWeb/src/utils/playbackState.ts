import type { PlaybackState } from '@cherryplay/components';

import type { PlaybackStateDto } from '../types/api';

export const pickFresherPosition = (
  current: { position: number; lastUpdatedAt?: string } | null,
  incoming: { position: number; lastUpdatedAt: string },
): number => {
  if (!current?.lastUpdatedAt) return incoming.position;
  const curTime = new Date(current.lastUpdatedAt).getTime();
  const incTime = new Date(incoming.lastUpdatedAt).getTime();
  return curTime > incTime ? current.position : incoming.position;
};

export const playbackStateFromDto = (
  dto: PlaybackStateDto,
  currentRef: { position: number; lastUpdatedAt?: string } | null,
): PlaybackState => {
  const position = pickFresherPosition(currentRef, dto);
  return {
    currentTrackId: dto.currentTrackId,
    status: dto.status,
    position,
    duration: dto.duration,
    volume: dto.volume,
    mode: dto.mode,
    playedTrackIds: dto.playedTrackIds || [],
    disabledTrackIds: dto.disabledTrackIds || [],
    disabledGroupIds: dto.disabledGroupIds || [],
    lastUpdatedAt: dto.lastUpdatedAt,
  };
};
