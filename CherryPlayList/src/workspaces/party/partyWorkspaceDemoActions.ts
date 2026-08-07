import { DEMO_LINKED_PARTY, demoSetPartyLifecycleState } from '@shared/demo/demoPartyFixture';
import { getAppMode } from '@shared/platform';
import { isDemoFixturesMode } from '@shared/platform/demoLiveMode';
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
  return isDemoFixturesMode(getAppMode());
}

function clearEditorDemoOverrides(): void {
  resetEditorDemoState();
}

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
  demoSetPartyLifecycleState('draft');
  getPartyStore().setPartyLifecycleState(null);
}

export function demoSetLinkedLifecycle(lifecycle: PartyLifecycleState): void {
  if (!guardDemoMode()) return;
  clearEditorDemoOverrides();
  clearPartyNotFoundProductionFlags(true);
  getProjectStore().setLinkedParty(DEMO_LINKED_PARTY);
  demoSetPartyLifecycleState(lifecycle);
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
  demoSetPartyLifecycleState('draft');
  getPartyStore().setPartyLifecycleState('draft');
}
