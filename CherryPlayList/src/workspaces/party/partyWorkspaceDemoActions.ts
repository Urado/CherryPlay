import {
  getDefaultCustomizationSettings,
  type PartyThemeId,
  type PartyViewerStatusId,
  type PlaybackState,
} from '@cherryplay/components';

import { DEMO_LINKED_PARTY, demoTransitionPartyLifecycle } from '@shared/demo/demoPartyFixture';
import { getAppMode } from '@shared/platform';
import type { PartyLifecycleState } from '@shared/services/partyService';
import { useProjectStore } from '@shared/stores/projectStore';

import type { PartyEditorBlockedReason } from './partyEditorPhase';
import { ERROR_PARTY_NOT_FOUND } from './partyWorkspaceConstants';
import { usePartyWorkspaceStore } from './partyWorkspaceStore';

export const DEMO_MOCK_LIVE_PLAYBACK: PlaybackState = {
  currentTrackId: 'demo-track-1',
  status: 'playing',
  position: 42,
  duration: 180,
  volume: 1,
  mode: 'session',
  playedTrackIds: [],
  disabledTrackIds: [],
  disabledGroupIds: [],
  lastUpdatedAt: '2025-06-01T12:00:00.000Z',
};

function getPartyStore() {
  return usePartyWorkspaceStore.getState();
}

function getProjectStore() {
  return useProjectStore.getState();
}

function isDemoMode(): boolean {
  return getAppMode() === 'demo';
}

function guardDemoMode(): boolean {
  return isDemoMode();
}

function clearDemoOverrides(): void {
  const store = getPartyStore();
  store.setDemoBlockedOverride(null);
  store.setDemoPreviewLive(false);
  store.setDemoPreviewViewerStatusOverride(null);
  store.setPreviewLifecycleOverride(null);
  store.setPreviewCurrentTrackNumber(null);
  store.setPreviewThemeOverride(null);
  store.setPreviewCustomizationSettingsOverride(null);
  store.setIsPreviewSynchronized(true);
  store.setServerError(null);
  store.setServerUnreachable(false);
  store.setIsReconnecting(false);
  store.setLastManualCheckFailed(false);
}

export type DemoPreviewConnectionScenario =
  | 'connecting'
  | 'server_unreachable'
  | 'reconnecting'
  | 'organizer_offline'
  | 'party_not_found';

export function demoSetUnlinkedDraft(): void {
  if (!guardDemoMode()) return;
  clearDemoOverrides();
  getProjectStore().setLinkedParty(null);
  demoTransitionPartyLifecycle('draft');
  getPartyStore().setPartyLifecycleState(null);
}

export function demoSetLinkedLifecycle(lifecycle: PartyLifecycleState): void {
  if (!guardDemoMode()) return;
  clearDemoOverrides();
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
  store.setDemoBlockedOverride(reason);
}

/** Linked party exists in file meta, but server no longer has it. */
export function demoSetPartyNotFound(): void {
  if (!guardDemoMode()) return;
  const store = getPartyStore();
  store.setDemoPreviewLive(false);
  getProjectStore().setLinkedParty(DEMO_LINKED_PARTY);
  store.setServerError(ERROR_PARTY_NOT_FOUND);
  store.setPartyVerified(false);
  store.setDemoBlockedOverride('party-not-found');
}

export function demoResetToDefault(): void {
  if (!guardDemoMode()) return;
  clearDemoOverrides();
  getProjectStore().setLinkedParty(DEMO_LINKED_PARTY);
  demoTransitionPartyLifecycle('draft');
  getPartyStore().setPartyLifecycleState('draft');
}

export function demoSetPreviewLifecycle(lifecycle: PartyLifecycleState): void {
  if (!guardDemoMode()) return;
  const store = getPartyStore();
  store.setIsPreviewSynchronized(false);
  store.setPreviewLifecycleOverride(lifecycle);
  store.setDemoPreviewLive(false);
  store.setDemoPreviewViewerStatusOverride(null);
  store.setPreviewCurrentTrackNumber(null);
}

export function demoSetPreviewLive(): void {
  if (!guardDemoMode()) return;
  const store = getPartyStore();
  store.setIsPreviewSynchronized(false);
  store.setPreviewLifecycleOverride('ready');
  store.setDemoPreviewLive(true);
  store.setDemoPreviewViewerStatusOverride(null);
  if (store.previewCurrentTrackNumber == null || store.previewCurrentTrackNumber < 1) {
    store.setPreviewCurrentTrackNumber(1);
  }
}

export function demoSyncPreviewWithActual(): void {
  if (!guardDemoMode()) return;
  const store = getPartyStore();
  store.setIsPreviewSynchronized(true);
  store.setPreviewLifecycleOverride(null);
  store.setDemoPreviewLive(false);
  store.setDemoPreviewViewerStatusOverride(null);
  store.setPreviewCurrentTrackNumber(null);
  store.setPreviewThemeOverride(null);
  store.setPreviewCustomizationSettingsOverride(null);
}

function ensurePreviewTrackNumberSelected(): void {
  const store = getPartyStore();
  if (store.previewCurrentTrackNumber == null || store.previewCurrentTrackNumber < 1) {
    store.setPreviewCurrentTrackNumber(1);
  }
}

export function demoSetPreviewConnectionBreak(scenario: DemoPreviewConnectionScenario): void {
  if (!guardDemoMode()) return;
  const store = getPartyStore();
  store.setIsPreviewSynchronized(false);
  store.setPreviewLifecycleOverride('ready');
  ensurePreviewTrackNumberSelected();
  store.setDemoPreviewLive(true);

  const viewerStatusByScenario: Record<DemoPreviewConnectionScenario, PartyViewerStatusId> = {
    connecting: 'connecting',
    server_unreachable: 'server_unreachable',
    reconnecting: 'connecting',
    organizer_offline: 'organizer_offline',
    party_not_found: 'server_unreachable',
  };

  store.setDemoPreviewViewerStatusOverride(viewerStatusByScenario[scenario]);
}

export function demoSetPreviewTrackNumber(trackNumber: number | null): void {
  if (!guardDemoMode()) return;
  const store = getPartyStore();
  const normalized =
    trackNumber == null || Number.isNaN(trackNumber) ? null : Math.max(1, Math.floor(trackNumber));
  store.setIsPreviewSynchronized(false);
  store.setPreviewLifecycleOverride('ready');
  store.setDemoPreviewViewerStatusOverride(null);
  store.setDemoPreviewLive(true);
  store.setPreviewCurrentTrackNumber(normalized ?? 1);
}

export function demoSetPreviewTheme(themeId: PartyThemeId): void {
  if (!guardDemoMode()) return;
  const store = getPartyStore();
  store.setIsPreviewSynchronized(false);
  store.setPreviewThemeOverride(themeId);
  if (store.previewCustomizationSettingsOverride == null) {
    store.setPreviewCustomizationSettingsOverride(
      getDefaultCustomizationSettings(themeId) as Record<string, unknown>,
    );
  }
}

export function demoSetPreviewCustomizationSettings(settings: Record<string, unknown>): void {
  if (!guardDemoMode()) return;
  const store = getPartyStore();
  store.setIsPreviewSynchronized(false);
  store.setPreviewCustomizationSettingsOverride(settings);
}
