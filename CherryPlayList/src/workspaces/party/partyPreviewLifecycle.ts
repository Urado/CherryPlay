import type { PartyViewerStatusId, PlaybackState } from '@cherryplay/components';

import type { PartyLifecycleState } from '@shared/services/partyService';

/** True when playback reflects an active live session (not an idle session snapshot). */
export function isPlaybackLiveActive(playbackState: PlaybackState | null | undefined): boolean {
  if (playbackState == null) {
    return false;
  }
  if (playbackState.status === 'playing') {
    return true;
  }
  return playbackState.mode === 'session' && playbackState.status === 'paused';
}

export function resolvePreviewViewerStatusId(
  playbackState: PlaybackState | null | undefined,
  previewLifecycleState?: PartyLifecycleState | null,
): PartyViewerStatusId {
  if (isPlaybackLiveActive(playbackState)) {
    return 'live';
  }

  const lifecycle = previewLifecycleState ?? 'draft';
  if (lifecycle === 'completed') {
    return 'party_ended';
  }
  if (lifecycle === 'ready') {
    return 'starting_soon';
  }
  return 'draft';
}
