import type { PartyViewerStatusId, PlaybackState } from '@cherryplay/components';

export const DISCONNECT_FREEZE_MS = 60_000;

export function resolveShowPlayerByStatus(params: {
  viewerStatusId: PartyViewerStatusId;
  isDisconnectFreezeActive: boolean;
  playbackState: PlaybackState | null;
}): boolean {
  const { viewerStatusId, isDisconnectFreezeActive, playbackState } = params;

  if (viewerStatusId === 'server_unreachable') {
    return false;
  }

  if (
    viewerStatusId === 'live' ||
    viewerStatusId === 'organizer_offline' ||
    viewerStatusId === 'program_ended'
  ) {
    return true;
  }

  if (isDisconnectFreezeActive && playbackState != null) {
    return true;
  }

  return false;
}

export function applyOrganizerConnectionStatusChanged(params: {
  isOnline: boolean;
  clearSessionTimers: () => void;
  setIsSessionActive: (active: boolean) => void;
  setIsDisconnectFreezeActive: (active: boolean) => void;
  setPlaybackState: (state: null) => void;
  clearOfflineTimers: () => void;
  scheduleDisconnectFreeze: (fn: () => void, ms: number) => void;
  onOrganizerOnline?: () => void;
}): void {
  const {
    isOnline,
    clearSessionTimers,
    setIsSessionActive,
    setIsDisconnectFreezeActive,
    setPlaybackState,
    clearOfflineTimers,
    scheduleDisconnectFreeze,
    onOrganizerOnline,
  } = params;

  if (isOnline) {
    clearSessionTimers();
    setIsDisconnectFreezeActive(false);
    onOrganizerOnline?.();
    return;
  }

  clearOfflineTimers();
  setIsSessionActive(false);
  setIsDisconnectFreezeActive(true);
  scheduleDisconnectFreeze(() => {
    setPlaybackState(null);
    setIsDisconnectFreezeActive(false);
  }, DISCONNECT_FREEZE_MS);
}
