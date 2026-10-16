import {
  DEFAULT_PARTY_TRACK_DISPLAY_SETTINGS,
  type PartyTrackDisplaySettings,
} from '@core/types/project';

import {
  hasUsableAimpLiveStreamSnapshots,
  normalizeTrackKeyForComparison,
  type AimpBridgeState,
  type AimpConnectionPhase,
  type AimpGatingReason,
  type AimpPlaybackStatus,
  type AimpPlaylistSnapshotDto,
  type AimpPlaylistTrackDto,
} from '../contracts/aimp';
import {
  mapAimpPlaybackStatusToWireStatus,
  type PlaybackStateDto,
} from '../contracts/playbackState';

import { applyPartyTrackDisplayToTrackName, type PlayerItemForApi } from './partyUtils';

export interface AimpAvailability {
  available: boolean;
  gatingReasons: AimpGatingReason[];
}

const convertDurationMsToSeconds = (durationMs?: number): number => {
  if (typeof durationMs !== 'number' || durationMs <= 0) {
    return 0;
  }

  return Math.max(0, Math.round(durationMs / 1000));
};

export const getAimpAvailability = (
  state: Pick<AimpBridgeState, 'environment'>,
): AimpAvailability => {
  const gatingReasons = state.environment.gatingReasons.filter(
    (reason) => reason.code !== 'sourceNotAimp',
  );

  return {
    available: gatingReasons.length === 0,
    gatingReasons,
  };
};

export const isAimpDegraded = (state: Pick<AimpBridgeState, 'connection'>): boolean => {
  return (
    state.connection.phase === 'stale' ||
    state.connection.protocolError !== null ||
    state.connection.disconnectReason !== null
  );
};

export const getAimpCurrentTrack = (
  state: Pick<AimpBridgeState, 'playlistSnapshot' | 'playbackSnapshot'>,
): AimpPlaylistTrackDto | null => {
  const trackKey =
    state.playbackSnapshot?.currentTrackKey ?? state.playlistSnapshot?.activeTrackKey ?? null;

  if (!trackKey || state.playlistSnapshot === null) {
    return null;
  }

  const normalizedKey = normalizeTrackKeyForComparison(trackKey);
  return (
    state.playlistSnapshot.tracks.find(
      (track) => normalizeTrackKeyForComparison(track.trackKey) === normalizedKey,
    ) ?? null
  );
};

export const getAimpEffectiveProgressMs = (
  state: Pick<AimpBridgeState, 'connection' | 'playbackSnapshot'>,
  nowMs: number = Date.now(),
): number => {
  const playbackSnapshot = state.playbackSnapshot;
  if (playbackSnapshot === null) {
    return 0;
  }

  let progressMs = playbackSnapshot.positionMs;
  if (playbackSnapshot.status === 'playing' && state.connection.phase === 'connected') {
    const receivedAtMs = Date.parse(playbackSnapshot.receivedAt);
    if (!Number.isNaN(receivedAtMs)) {
      progressMs += Math.max(0, nowMs - receivedAtMs);
    }
  }

  if (typeof playbackSnapshot.durationMs === 'number') {
    progressMs = Math.min(progressMs, playbackSnapshot.durationMs);
  }

  return Math.max(0, progressMs);
};

export const createAimpPlaybackStateDto = (
  state: Pick<
    AimpBridgeState,
    'connection' | 'playlistSnapshot' | 'playbackSnapshot' | 'liveStreamStarted'
  >,
  nowMs: number = Date.now(),
): PlaybackStateDto => {
  const currentTrack = getAimpCurrentTrack(state);
  const currentTrackKey =
    state.playbackSnapshot?.currentTrackKey ?? state.playlistSnapshot?.activeTrackKey ?? null;
  const currentTrackOrder = currentTrack?.order ?? null;

  return {
    currentTrackId: currentTrackKey,
    status: mapAimpPlaybackStatusToWireStatus(state.playbackSnapshot?.status),
    position: getAimpEffectiveProgressMs(state, nowMs) / 1000,
    duration: convertDurationMsToSeconds(
      state.playbackSnapshot?.durationMs ?? currentTrack?.durationMs,
    ),
    volume:
      typeof state.playbackSnapshot?.volumePercent === 'number'
        ? state.playbackSnapshot.volumePercent / 100
        : 0.8,
    mode: state.liveStreamStarted ? 'session' : 'preparation',
    playedTrackIds:
      currentTrackOrder === null || state.playlistSnapshot === null
        ? []
        : state.playlistSnapshot.tracks
            .filter((track) => track.order < currentTrackOrder)
            .map((track) => track.trackKey),
    disabledTrackIds: [],
    disabledGroupIds: [],
    lastUpdatedAt: new Date(nowMs).toISOString(),
  };
};

const getAimpTrackDisplayName = (track: AimpPlaylistTrackDto): string => {
  if (track.artist && track.artist.trim().length > 0) {
    return `${track.artist} - ${track.title}`;
  }

  return track.title;
};

export const convertAimpPlaylistForApi = (
  playlistSnapshot: Pick<AimpPlaylistSnapshotDto, 'tracks'> | null,
  trackDisplay: PartyTrackDisplaySettings = DEFAULT_PARTY_TRACK_DISPLAY_SETTINGS,
): {
  items: PlayerItemForApi[];
  totalTracks: number;
  totalDuration: number;
} => {
  const tracks = playlistSnapshot?.tracks ?? [];

  return {
    items: tracks.map((track) => {
      const rawName = getAimpTrackDisplayName(track);
      const name = applyPartyTrackDisplayToTrackName(rawName, trackDisplay);
      return {
        id: track.trackKey,
        type: 'track',
        name,
        duration: convertDurationMsToSeconds(track.durationMs),
        displayOrder: track.order,
        level: 0,
      };
    }),
    totalTracks: tracks.length,
    totalDuration: tracks.reduce(
      (sum, track) => sum + convertDurationMsToSeconds(track.durationMs),
      0,
    ),
  };
};

export const canUseAimpLiveSnapshots = (
  state: Pick<AimpBridgeState, 'playlistSnapshot' | 'playbackSnapshot'>,
): boolean => {
  return hasUsableAimpLiveStreamSnapshots(state.playlistSnapshot, state.playbackSnapshot);
};

export const canStartAimpLiveStream = (
  state: Pick<
    AimpBridgeState,
    | 'sourceSelection'
    | 'environment'
    | 'connection'
    | 'pluginMetadata'
    | 'playlistSnapshot'
    | 'playbackSnapshot'
  >,
): boolean => {
  return (
    state.sourceSelection === 'aimp' &&
    state.environment.eligible &&
    state.connection.phase === 'connected' &&
    state.connection.pluginConnected &&
    state.pluginMetadata !== null &&
    canUseAimpLiveSnapshots(state)
  );
};

export const getAimpPlaylistPublishKey = (
  playlistSnapshot: Pick<AimpPlaylistSnapshotDto, 'playlistId' | 'revision'> | null,
): string | null => {
  if (playlistSnapshot === null) {
    return null;
  }

  return `${playlistSnapshot.playlistId}:${playlistSnapshot.revision}`;
};

export const getAimpPlaybackPublishKey = (
  state: Pick<
    AimpBridgeState,
    'connection' | 'playlistSnapshot' | 'playbackSnapshot' | 'liveStreamStarted'
  >,
): string => {
  return JSON.stringify({
    connectionPhase: state.connection.phase,
    playlistRevision: state.playlistSnapshot?.revision ?? null,
    playbackStatus: state.playbackSnapshot?.status ?? null,
    currentTrackKey: state.playbackSnapshot?.currentTrackKey ?? null,
    liveStreamStarted: state.liveStreamStarted,
  });
};

export const canAdvanceAimpPlayback = (
  connectionPhase: AimpConnectionPhase,
  playbackStatus: AimpPlaybackStatus | null | undefined,
): boolean => {
  return connectionPhase === 'connected' && playbackStatus === 'playing';
};
