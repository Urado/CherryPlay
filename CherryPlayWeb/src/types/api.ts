/**
 * Типы для API запросов и ответов
 */

export interface PartyPlaylistDto {
  items: PlayerItemDto[];
  totalDuration: number;
  totalTracks: number;
}

export interface PlayerItemDto {
  id: string;
  type: 'track' | 'group';
  name: string;
  duration?: number;
  items?: PlayerItemDto[];
  displayOrder: number;
  level: number;
}

export interface PublicPartyDto {
  id: string;
  name: string;
  themeId: string;
  customizationSettings?: Record<string, any>;
  hasActiveSession: boolean;
  sessionStartedAt?: string;
}

export interface PartyStateDto {
  partyId: string;
  isSessionActive: boolean;
  sessionStartedAt?: string;
  playbackState?: PlaybackStateDto;
  playlist: PartyPlaylistDto;
}

export interface PlaybackStateDto {
  currentTrackId: string | null;
  status: 'idle' | 'playing' | 'paused' | 'ended';
  position: number;
  duration: number;
  volume: number;
  mode: 'preparation' | 'session';
  playedTrackIds: string[];
  disabledTrackIds: string[];
  disabledGroupIds: string[];
  lastUpdatedAt: string;
}

export interface PublicPartyListItemDto {
  id: string;
  name: string;
  shortCode: string;
  themeId: string;
  hasActiveSession: boolean;
  createdAt: string;
  totalTracks: number;
  totalDuration: number;
  eventDateTime?: string;
}

