import type { ProjectSessionMode } from '@core/types/project';
import type {
  AimpBridgeState,
  AimpPlaybackStatus,
  AimpSourceSelection,
} from '@shared/contracts/aimp';
import type { StorePlaybackStatus } from '@shared/contracts/storePlaybackStatus';

import { detectAimpLiveProgramEnded } from './detectAimpLiveProgramEnded';

export type PartyPlaybackSourceStatus = StorePlaybackStatus | AimpPlaybackStatus | null;
export type PartyArchivePlaybackActivity = 'playing' | 'paused' | 'live' | 'inactive';

export interface PartyPlaybackSourceInput {
  streamingSource: AimpSourceSelection;
  sessionMode: ProjectSessionMode;
  playerPlaybackStatus: StorePlaybackStatus;
  aimpBridgeState: AimpBridgeState;
  programEnded?: boolean;
}

export interface PartyPlaybackSourceState {
  sessionActive: boolean;
  headerActive: boolean;
  playbackStatus: PartyPlaybackSourceStatus;
  headerPlaybackStatus: StorePlaybackStatus | null;
  archiveActivity: PartyArchivePlaybackActivity;
  playlistRevision: number | null;
  playlistTrackCount: number;
}

export interface PartyPlaybackSourceAdapter {
  completionDetection: 'track-event' | 'playback-snapshot';
  resolveState: (input: PartyPlaybackSourceInput) => PartyPlaybackSourceState;
  detectProgramEnded: (input: PartyPlaybackSourceInput) => boolean;
}

const cherryPlayPartyPlaybackSource: PartyPlaybackSourceAdapter = {
  completionDetection: 'track-event',
  resolveState: (input) => {
    const sessionActive = input.sessionMode === 'session';
    const playbackStatus = sessionActive ? input.playerPlaybackStatus : null;

    return {
      sessionActive,
      headerActive: sessionActive,
      playbackStatus,
      headerPlaybackStatus: playbackStatus,
      archiveActivity: !sessionActive
        ? 'inactive'
        : playbackStatus === 'playing'
          ? 'playing'
          : playbackStatus === 'paused'
            ? 'paused'
            : 'inactive',
      playlistRevision: null,
      playlistTrackCount: 0,
    };
  },
  detectProgramEnded: () => false,
};

const aimpPartyPlaybackSource: PartyPlaybackSourceAdapter = {
  completionDetection: 'playback-snapshot',
  resolveState: (input) => {
    const sessionActive = input.aimpBridgeState.liveStreamStarted;
    const playbackStatus = sessionActive
      ? (input.aimpBridgeState.playbackSnapshot?.status ?? null)
      : null;
    const isAimpPlaybackActive =
      playbackStatus === 'playing' || playbackStatus === 'paused' || input.programEnded === true;

    return {
      sessionActive,
      headerActive: sessionActive && isAimpPlaybackActive,
      playbackStatus,
      headerPlaybackStatus: null,
      archiveActivity: !sessionActive
        ? 'inactive'
        : playbackStatus === 'playing'
          ? 'playing'
          : playbackStatus === 'paused'
            ? 'paused'
            : playbackStatus === 'stopped'
              ? 'inactive'
              : 'live',
      playlistRevision: input.aimpBridgeState.playlistSnapshot?.revision ?? null,
      playlistTrackCount: input.aimpBridgeState.playlistSnapshot?.trackCount ?? 0,
    };
  },
  detectProgramEnded: (input) => detectAimpLiveProgramEnded(input.aimpBridgeState),
};

const partyPlaybackSourceAdapters: Record<AimpSourceSelection, PartyPlaybackSourceAdapter> = {
  cherryPlayPlayer: cherryPlayPartyPlaybackSource,
  aimp: aimpPartyPlaybackSource,
};

export const getPartyPlaybackSourceAdapter = (
  streamingSource: AimpSourceSelection,
): PartyPlaybackSourceAdapter => partyPlaybackSourceAdapters[streamingSource];

export const resolvePartyPlaybackSourceState = (
  sourceOrInput: AimpSourceSelection | undefined | PartyPlaybackSourceInput,
  context?: Omit<PartyPlaybackSourceInput, 'streamingSource'>,
): PartyPlaybackSourceState => {
  const input = typeof sourceOrInput === 'object' && sourceOrInput !== null
    ? sourceOrInput
    : {
        ...context,
        streamingSource: sourceOrInput ?? 'cherryPlayPlayer',
      } as PartyPlaybackSourceInput;

  return getPartyPlaybackSourceAdapter(input.streamingSource ?? 'cherryPlayPlayer').resolveState(input);
};
