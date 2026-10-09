import type { PartyLifecycleState } from '@shared/services/partyService';

import type { PartyPlaybackSourceState } from './partyPlaybackSource';

export type PartyArchiveAvailabilityMode = 'active' | 'quiet' | 'blockedByLive' | 'hidden';

export interface PartyArchiveAvailabilityInput {
  partyLifecycleState: PartyLifecycleState | null | undefined;
  playbackSourceState: PartyPlaybackSourceState;
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

export const resolvePartyArchiveAvailability = (
  input: PartyArchiveAvailabilityInput,
): PartyArchiveAvailability => {
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

  if (
    input.playbackSourceState.archiveActivity === 'playing' ||
    input.playbackSourceState.archiveActivity === 'live'
  ) {
    return {
      mode: 'blockedByLive',
      showDangerSection: true,
      canArchive: false,
      isQuiet: false,
      isBlockedByLive: true,
      blockedExplanation: PARTY_ARCHIVE_LIVE_BLOCKED_EXPLANATION,
    };
  }

  if (input.playbackSourceState.archiveActivity === 'paused') {
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
};
