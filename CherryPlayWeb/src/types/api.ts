export interface AppConfigResponse {
  oauthEnabled: boolean;
  partyInfoPageEnabled: boolean;
}

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
  title?: string;
  subtitle?: string;
  partyThemeId: string;
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
  serverTrackIds?: string[];
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
  partyThemeId: string;
  hasActiveSession: boolean;
  createdAt: string;
  totalTracks: number;
  totalDuration: number;
  eventDateTime?: string;
  timeZone?: string;
  city?: string;
  shortDescription?: string;
  externalLinkUrl?: string;
  externalLinkText?: string;
  danceTags?: string[];
}

export interface PartyDto {
  id: string;
  name: string;
  title?: string;
  subtitle?: string;
  shortCode: string;
  partyThemeId: string;
  createdAt: string;
  hasActiveSession: boolean;
  eventDateTime?: string;
  isListedInCatalog: boolean;
  description?: string;
  place?: string;
  city?: string;
  schedule?: string;
  timeZone?: string;
  shortDescription?: string;
  externalLinkUrl?: string;
  externalLinkText?: string;
  danceTags?: string[];
}

export interface CreatePartyDto {
  name: string;
  title?: string;
  subtitle?: string;
  partyThemeId: string;
  eventDateTime?: string;
  isListedInCatalog?: boolean;
  description?: string;
  place?: string;
  city?: string;
  schedule?: string;
  timeZone?: string;
  shortDescription?: string;
  externalLinkUrl?: string;
  externalLinkText?: string;
  danceTags?: string[];
}

export interface UpdatePartyDto {
  name?: string;
  title?: string;
  subtitle?: string;
  partyThemeId?: string;
  eventDateTime?: string;
  isListedInCatalog?: boolean;
  description?: string;
  place?: string;
  city?: string;
  schedule?: string;
  timeZone?: string;
  shortDescription?: string;
  externalLinkUrl?: string;
  externalLinkText?: string;
  danceTags?: string[];
}

export type { OrganizerDto } from '@cherryplay/components';
