import { resetPreviewScenario } from './partyPreviewScenarioActions';
import { clearPartyProgramEnded } from './partyProgramEndedStore';
import { resetPartySettingsUiState } from './partySettingsUiStore';
import {
  clearPartyWorkspaceLinkedPartyCheck,
  partyWorkspaceOneShotGuards,
  partyWorkspaceReconnectRefs,
} from './partyWorkspaceReconnectRefs';
import { resetPartyWorkspaceState } from './partyWorkspaceStore';

export function resetPartyWorkspaceForFreshProject(): void {
  resetPartyWorkspaceState();
  resetPartySettingsUiState();
  clearPartyProgramEnded();
  resetPreviewScenario();
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
