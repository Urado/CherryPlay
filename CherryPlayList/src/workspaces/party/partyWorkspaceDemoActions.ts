import { DEMO_LINKED_PARTY, demoTransitionPartyLifecycle } from '@shared/demo/demoPartyFixture';
import { getAppMode } from '@shared/platform';
import type { PartyLifecycleState } from '@shared/services/partyService';
import { useProjectStore } from '@shared/stores/projectStore';

import { resetEditorDemoState, usePartyEditorDemoStore } from './partyEditorDemoStore';
import type { PartyEditorBlockedReason } from './partyEditorPhase';
import { resetPreviewScenario } from './partyPreviewScenarioActions';
import { ERROR_PARTY_NOT_FOUND } from './partyWorkspaceConstants';
import { usePartyWorkspaceStore } from './partyWorkspaceStore';

function getPartyStore() {
  return usePartyWorkspaceStore.getState();
}

function getProjectStore() {
  return useProjectStore.getState();
}

function guardDemoMode(): boolean {
  return getAppMode() === 'demo';
}

/** Clears editor demo overlay only — does not touch scenario or production server flags. */
function clearEditorDemoOverrides(): void {
  resetEditorDemoState();
}

/** Clears party-not-found production flags when leaving that demo fixture. */
function clearPartyNotFoundProductionFlags(partyExistsOnServer: boolean): void {
  const store = getPartyStore();
  store.setServerError(null);
  store.setPartyVerified(partyExistsOnServer);
}

export function demoSetUnlinkedDraft(): void {
  if (!guardDemoMode()) return;
  clearEditorDemoOverrides();
  clearPartyNotFoundProductionFlags(false);
  getProjectStore().setLinkedParty(null);
  demoTransitionPartyLifecycle('draft');
  getPartyStore().setPartyLifecycleState(null);
}

export function demoSetLinkedLifecycle(lifecycle: PartyLifecycleState): void {
  if (!guardDemoMode()) return;
  clearEditorDemoOverrides();
  clearPartyNotFoundProductionFlags(true);
  getProjectStore().setLinkedParty(DEMO_LINKED_PARTY);
  demoTransitionPartyLifecycle(lifecycle);
  getPartyStore().setPartyLifecycleState(lifecycle);
}

export function demoSetBlockedOverride(reason: PartyEditorBlockedReason): void {
  if (!guardDemoMode()) return;
  const store = getPartyStore();
  if (reason === 'party-not-found') {
    demoSetPartyNotFound();
    return;
  }
  store.setServerError(null);
  usePartyEditorDemoStore.getState().setBlockedOverride(reason);
}

/** Linked party exists in file meta, but server no longer has it. */
export function demoSetPartyNotFound(): void {
  if (!guardDemoMode()) return;
  const store = getPartyStore();
  getProjectStore().setLinkedParty(DEMO_LINKED_PARTY);
  store.setServerError(ERROR_PARTY_NOT_FOUND);
  store.setPartyVerified(false);
  usePartyEditorDemoStore.getState().setBlockedOverride('party-not-found');
}

export function demoResetToDefault(): void {
  if (!guardDemoMode()) return;
  clearEditorDemoOverrides();
  resetPreviewScenario();
  clearPartyNotFoundProductionFlags(true);
  getProjectStore().setLinkedParty(DEMO_LINKED_PARTY);
  demoTransitionPartyLifecycle('draft');
  getPartyStore().setPartyLifecycleState('draft');
}
