import type { ThemeId, CustomizationSettings } from '../themes';

export * from './auth';

export interface PlayerItem {
  id: string;
  type: 'track' | 'group';
  name: string;
  path?: string;
  duration?: number;
  items?: PlayerItem[];
  displayOrder: number;
  level: number;
}

export interface PlaybackState {
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

export interface PartyPlaylistData {
  items: PlayerItem[];
  totalDuration: number;
  totalTracks: number;
}

export interface PartyDisplayData<T extends ThemeId = ThemeId> {
  partyId: string;
  partyName: string;
  themeId: T;
  customizationSettings?: CustomizationSettings<T>;
  playlist: PartyPlaylistData;
  playbackState?: PlaybackState | null;
  isSessionActive: boolean;
}
