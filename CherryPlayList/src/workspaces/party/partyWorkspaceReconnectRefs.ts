/**
 * Module-level reconnect timer state shared across all `usePartyWorkspaceRuntime` mounts.
 * Party Editor and Preview may mount/unmount independently; only one reconnect interval
 * should run per app session. `effectsMountCount` tracks active hook instances so cleanup
 * stops the timer only when the last party workspace unmounts.
 */
export type PartyWorkspaceLinkedPartyRef = { id: string; shortCode: string };

export const partyWorkspaceReconnectRefs = {
  intervalId: null as ReturnType<typeof setInterval> | null,
  cancelled: false,
  effectsMountCount: 0,
  /** Latest linked party for reconnect restore; avoids stale closures with multiple mounts. */
  linkedParty: null as PartyWorkspaceLinkedPartyRef | null,
};

/** Dedupes one-shot network effects when Editor and Preview mount together. */
export const partyWorkspaceOneShotGuards = {
  themeAccessGuardKey: null as string | null,
  loadedPartyMetadataId: null as string | null,
  oauthCallbackRegistered: false,
};

/**
 * Shared linked-party reachability check (Editor + Preview + StrictMode remounts).
 * Only one check per partyId runs at a time; other mounts await the same promise.
 */
export const partyWorkspaceLinkedPartyCheck = {
  seq: 0,
  inFlight: null as {
    partyId: string;
    seq: number;
    promise: Promise<void>;
  } | null,
};

export function clearPartyWorkspaceLinkedPartyCheck(): void {
  partyWorkspaceLinkedPartyCheck.seq += 1;
  partyWorkspaceLinkedPartyCheck.inFlight = null;
}
