import type { PartyViewerStatus } from '../constants/partyViewerStatus';
import type { PartyThemeId, CustomizationSettings } from '../themes';

export * from './auth';
export {
  isPartyDisplayStatusId,
  partyViewerStatusFromId,
  PARTY_DISPLAY_STATUS_IDS,
} from '../constants/partyViewerStatus';
export type {
  PartyDisplayStatusId,
  PartyViewerStatus,
  PartyViewerStatusId,
} from '../constants/partyViewerStatus';
export { mergePartyViewerStatus } from '../core/party/mergePartyViewerStatus';
export { isProgramEnded } from '../core/party/isProgramEnded';
export type {
  MergePartyViewerStatusInput,
  SignalRConnectionStatus,
} from '../core/party/mergePartyViewerStatus';
export { PartySessionIndicator } from '../components/PartySessionIndicator/PartySessionIndicator';
export type { PartySessionIndicatorProps } from '../components/PartySessionIndicator/PartySessionIndicator';

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

export interface PartyDisplayData<T extends PartyThemeId = PartyThemeId> {
  partyId: string;
  partyName: string;
  subtitle?: string | null;
  themeId: T;
  customizationSettings?: CustomizationSettings<T>;
  playlist: PartyPlaylistData;
  playbackState?: PlaybackState | null;
  isSessionActive: boolean;
  /** Merged viewer status (server + client overlays). */
  viewerStatus: PartyViewerStatus;
}
