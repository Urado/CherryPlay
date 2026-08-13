import type { AimpPlaybackStatus } from '@shared/contracts/aimp';
import type { StorePlaybackStatus } from '@shared/contracts/storePlaybackStatus';
import type { PartyLifecycleState } from '@shared/services/partyService';

export type PartyArchiveAvailabilityMode = 'active' | 'quiet' | 'blockedByLive' | 'hidden';

export interface PartyArchiveAvailabilityInput {
  partyLifecycleState: PartyLifecycleState | null | undefined;
  sessionMode: string;
  playbackStatus?: StorePlaybackStatus | null;
  aimpLiveStreamStarted?: boolean;
  aimpPlaybackStatus?: AimpPlaybackStatus | null;
  streamingSource?: string;
}

export interface PartyArchiveAvailability {
  mode: PartyArchiveAvailabilityMode;
  showDangerSection: boolean;
  canArchive: boolean;
  isQuiet: boolean;
  isBlockedByLive: boolean;
  blockedExplanation: string | null;
}

export const PARTY_ARCHIVE_CONFIRM_MESSAGE =
  'Отправить вечеринку в архив? Гости перестанут видеть её как активную. Можно будет вернуть из архива с пульта.';

export const PARTY_ARCHIVE_LIVE_BLOCKED_EXPLANATION =
  'Сначала остановите проигрывание или выключите онлайн — нельзя отправить в архив во время эфира';

export function resolvePartyArchiveAvailability(
  input: PartyArchiveAvailabilityInput,
): PartyArchiveAvailability {
  if (input.partyLifecycleState !== 'ready') {
    return {
      mode: 'hidden',
      showDangerSection: false,
      canArchive: false,
      isQuiet: false,
      isBlockedByLive: false,
      blockedExplanation: null,
    };
  }

  const isAimpLive = input.streamingSource === 'aimp' && input.aimpLiveStreamStarted === true;
  const isAimpPaused = isAimpLive && input.aimpPlaybackStatus === 'paused';
  const isCherryPlayPlaying =
    input.streamingSource !== 'aimp' &&
    input.sessionMode === 'session' &&
    input.playbackStatus === 'playing';
  const isCherryPlayPaused =
    input.streamingSource !== 'aimp' &&
    input.sessionMode === 'session' &&
    input.playbackStatus === 'paused';

  if ((isAimpLive && !isAimpPaused) || isCherryPlayPlaying) {
    return {
      mode: 'blockedByLive',
      showDangerSection: true,
      canArchive: false,
      isQuiet: false,
      isBlockedByLive: true,
      blockedExplanation: PARTY_ARCHIVE_LIVE_BLOCKED_EXPLANATION,
    };
  }

  if (isAimpPaused || isCherryPlayPaused) {
    return {
      mode: 'quiet',
      showDangerSection: true,
      canArchive: true,
      isQuiet: true,
      isBlockedByLive: false,
      blockedExplanation: null,
    };
  }

  return {
    mode: 'active',
    showDangerSection: true,
    canArchive: true,
    isQuiet: false,
    isBlockedByLive: false,
    blockedExplanation: null,
  };
}
