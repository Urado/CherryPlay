import type { PartyViewerStatusId, PlaybackState } from '@cherryplay/components';

/** Baseline playback snapshot for detached preview mock-live simulation. */
export const DEMO_MOCK_LIVE_PLAYBACK: PlaybackState = {
  currentTrackId: 'demo-track-1',
  status: 'playing',
  position: 42,
  duration: 180,
  volume: 1,
  mode: 'session',
  playedTrackIds: [],
  disabledTrackIds: [],
  disabledGroupIds: [],
  lastUpdatedAt: '2025-06-01T12:00:00.000Z',
};

export type PreviewConnectionScenario =
  | 'connecting'
  | 'server_unreachable'
  | 'reconnecting'
  | 'organizer_offline';

export const PREVIEW_CONNECTION_VIEWER_STATUS: Record<
  PreviewConnectionScenario,
  PartyViewerStatusId
> = {
  connecting: 'connecting',
  server_unreachable: 'server_unreachable',
  reconnecting: 'connecting',
  organizer_offline: 'organizer_offline',
};
