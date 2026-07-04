import type { AimpSourceSelection } from '../contracts/aimp';
import type { PlaybackStateDto } from '../contracts/playbackState';
import type { PlayerItemForApi } from '../utils/partyUtils';

export type PlaybackBroadcastSourceId = Extract<AimpSourceSelection, 'cherryPlayPlayer' | 'aimp'>;

export interface PlaylistForApiPayload {
  items: PlayerItemForApi[];
  totalTracks: number;
  totalDuration: number;
}

/**
 * Unified snapshot adapter for Site Streamer — CherryPlay Player or AIMP.
 * Orchestrator consumes one active implementation based on `streamingSource`.
 */
export interface PlaybackBroadcastSource {
  readonly sourceId: PlaybackBroadcastSourceId;

  /** Subscribe to changes that warrant full-state or position publish. */
  subscribe(callback: () => void): () => void;

  getPlaybackStateDto(): PlaybackStateDto;
  getCurrentTrackId(): string | null;
  getPosition(): number;

  /** Playlist payload for `partyService.updatePartyPlaylist` when items change. */
  getPlaylistForApi(): PlaylistForApiPayload;

  /** Whether live session (position ticks + StartSession) should be active. */
  isLiveSessionActive(): boolean;

  /** Whether periodic `UpdatePlaybackPosition` ticks should run (e.g. AIMP only while playing). */
  shouldSendPositionTicks(): boolean;
}
