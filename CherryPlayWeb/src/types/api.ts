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
  customizationSettings?: Record<string, string | number>;
  hasActiveSession: boolean;
  isListedInCatalog: boolean;
  sessionStartedAt?: string;
  description?: string;
  place?: string;
  city?: string;
  eventDateTime?: string;
  schedule?: string;
  timeZone?: string;
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
  sessionStartedAt?: string;
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

/** Вечеринка организатора (ответ GET /api/parties, GET /api/parties/:id) */
export interface PartyDto {
  id: string;
  name: string;
  shortCode: string;
  themeId: string;
  createdAt: string;
  hasActiveSession: boolean;
  eventDateTime?: string;
  isListedInCatalog: boolean;
  description?: string;
  place?: string;
  city?: string;
  schedule?: string;
  timeZone?: string;
}

/** Создание вечеринки (POST /api/parties) */
export interface CreatePartyDto {
  name: string;
  themeId: string;
  eventDateTime?: string;
  isListedInCatalog?: boolean;
  description?: string;
  place?: string;
  city?: string;
  schedule?: string;
  timeZone?: string;
}

/** Обновление метаданных (PUT /api/parties/:id) */
export interface UpdatePartyDto {
  name?: string;
  themeId?: string;
  eventDateTime?: string;
  isListedInCatalog?: boolean;
  description?: string;
  place?: string;
  city?: string;
  schedule?: string;
  timeZone?: string;
}

// OrganizerDto теперь экспортируется из @cherryplay/components
export type { OrganizerDto } from '@cherryplay/components';
