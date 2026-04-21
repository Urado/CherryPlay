export interface AppConfigResponse {
  oauthEnabled: boolean;
  partyInfoPageEnabled: boolean;
  adminContactUrl?: string;
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
  eventEndDateTime?: string;
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
  eventEndDateTime?: string;
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
  eventEndDateTime?: string;
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
  eventEndDateTime?: string;
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
  eventEndDateTime?: string;
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

export interface VisibleLockedThemeDto {
  themeId: string;
  packageCode: string;
  packageName: string;
}

export interface ThemeAccessDto {
  grantedThemeIds: string[];
  visibleLockedThemes: VisibleLockedThemeDto[];
  contactUrl: string;
}

export interface ApiErrorPayload {
  code?: string;
  message?: string;
  detail?: string;
  themeId?: string;
  requiredPackageCodes?: string[];
  existingEntitlementId?: string;
}

export interface AdminOrganizerListItemDto {
  id: string;
  name: string;
  email?: string;
  oauthProviders?: string[];
  oauthAccounts?: AdminOAuthAccountDto[];
  role: 'organizer' | 'admin';
  activeEntitlementsCount: number;
  createdAt: string;
}

export interface AdminOrganizerListResponse {
  items: AdminOrganizerListItemDto[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AdminOAuthAccountDto {
  provider: string;
  providerUserId?: string;
  providerUserName?: string;
}

export interface EntitlementDto {
  id: string;
  packageId: string;
  packageCode: string;
  packageName: string;
  kind: string;
  source: string;
  grantedAt: string;
  grantedByAdminId?: string | null;
  grantedByAdminName?: string | null;
  expiresAt?: string | null;
  usesRemaining?: number | null;
  revokedAt?: string | null;
  revokedByAdminId?: string | null;
  note?: string | null;
}

export interface AdminOrganizerDetailDto {
  id: string;
  name: string;
  email?: string;
  oauthAccounts?: AdminOAuthAccountDto[];
  role: 'organizer' | 'admin';
  createdAt: string;
  entitlements: EntitlementDto[];
}

export interface ThemePackageDto {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  isAutoGranted: boolean;
  isActive: boolean;
  themeIds: string[];
}

export interface ThemePackageListResponse {
  items: ThemePackageDto[];
}

export interface GrantEntitlementRequest {
  packageId: string;
  note: string;
}

export interface RevokeEntitlementRequest {
  note?: string;
}

export type { OrganizerDto } from '@cherryplay/components';
