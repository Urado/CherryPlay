export type PartyWorkspaceLinkedPartyRef = { id: string; shortCode: string };

export const partyWorkspaceReconnectRefs = {
  intervalId: null as ReturnType<typeof setInterval> | null,
  cancelled: false,
  effectsMountCount: 0,
  linkedParty: null as PartyWorkspaceLinkedPartyRef | null,
};

export const partyWorkspaceOneShotGuards = {
  loadedPartyMetadataId: null as string | null,
  oauthCallbackRegistered: false,
};

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
