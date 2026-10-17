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

const getPartyStore = () => {
  return usePartyWorkspaceStore.getState();
};

const getProjectStore = () => {
  return useProjectStore.getState();
};

const guardDemoMode = (): boolean => {
  return isDemoFixturesMode(getAppMode());
};

const clearEditorDemoOverrides = (): void => {
  resetEditorDemoState();
};

const clearPartyNotFoundProductionFlags = (partyExistsOnServer: boolean): void => {
  const store = getPartyStore();
  store.setServerError(null);
  store.setPartyVerified(partyExistsOnServer);
};

export const demoSetUnlinkedDraft = (): void => {
  if (!guardDemoMode()) return;
  clearEditorDemoOverrides();
  clearPartyNotFoundProductionFlags(false);
  getProjectStore().setLinkedParty(null);
  demoSetPartyLifecycleState('draft');
  getPartyStore().setPartyLifecycleState(null);
};

export const demoSetLinkedLifecycle = (lifecycle: PartyLifecycleState): void => {
  if (!guardDemoMode()) return;
  clearEditorDemoOverrides();
  clearPartyNotFoundProductionFlags(true);
  getProjectStore().setLinkedParty(DEMO_LINKED_PARTY);
  demoSetPartyLifecycleState(lifecycle);
  getPartyStore().setPartyLifecycleState(lifecycle);
};

export const demoSetBlockedOverride = (reason: PartyEditorBlockedReason): void => {
  if (!guardDemoMode()) return;
  const store = getPartyStore();
  if (reason === 'party-not-found') {
    demoSetPartyNotFound();
    return;
  }
  store.setServerError(null);
  usePartyEditorDemoStore.getState().setBlockedOverride(reason);
};

export const demoSetPartyNotFound = (): void => {
  if (!guardDemoMode()) return;
  const store = getPartyStore();
  getProjectStore().setLinkedParty(DEMO_LINKED_PARTY);
  store.setServerError(ERROR_PARTY_NOT_FOUND);
  store.setPartyVerified(false);
  usePartyEditorDemoStore.getState().setBlockedOverride('party-not-found');
};

export const demoResetToDefault = (): void => {
  if (!guardDemoMode()) return;
  clearEditorDemoOverrides();
  resetPreviewScenario();
  clearPartyNotFoundProductionFlags(true);
  getProjectStore().setLinkedParty(DEMO_LINKED_PARTY);
  demoSetPartyLifecycleState('ready');
  getPartyStore().setPartyLifecycleState('ready');
};
