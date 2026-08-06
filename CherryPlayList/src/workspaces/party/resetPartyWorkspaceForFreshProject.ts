import { resetPreviewScenario } from './partyPreviewScenarioActions';
import {
  clearPartyWorkspaceLinkedPartyCheck,
  partyWorkspaceOneShotGuards,
  partyWorkspaceReconnectRefs,
} from './partyWorkspaceReconnectRefs';
import { resetPartyWorkspaceState } from './partyWorkspaceStore';

export function resetPartyWorkspaceForFreshProject(): void {
  resetPartyWorkspaceState();
  resetPreviewScenario();
  partyWorkspaceOneShotGuards.themeAccessGuardKey = null;
  partyWorkspaceOneShotGuards.loadedPartyMetadataId = null;
  partyWorkspaceOneShotGuards.oauthCallbackRegistered = false;
  clearPartyWorkspaceLinkedPartyCheck();
  partyWorkspaceReconnectRefs.linkedParty = null;
  partyWorkspaceReconnectRefs.cancelled = true;
  if (partyWorkspaceReconnectRefs.intervalId !== null) {
    clearInterval(partyWorkspaceReconnectRefs.intervalId);
    partyWorkspaceReconnectRefs.intervalId = null;
  }
}
