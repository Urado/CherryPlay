import { getDefaultCustomizationSettings, type PartyThemeId } from '@cherryplay/components';

import type { PartyLifecycleState } from '@shared/services/partyService';

import {
  PREVIEW_CONNECTION_VIEWER_STATUS,
  type PreviewConnectionScenario,
} from './partyPreviewMockPlayback';
import {
  initialPartyPreviewScenarioState,
  usePartyPreviewScenarioStore,
} from './partyPreviewScenarioStore';

function getScenarioStore() {
  return usePartyPreviewScenarioStore.getState();
}

function ensurePreviewTrackNumberSelected(): void {
  const store = getScenarioStore();
  if (store.currentTrackNumber == null || store.currentTrackNumber < 1) {
    usePartyPreviewScenarioStore.setState({ currentTrackNumber: 1 });
  }
}

/**
 * Re-sync preview with production runtime: sets `isSynchronized: true` and clears all
 * scenario overrides (lifecycle, mock live, track, theme, connection break).
 *
 * Per reset matrix §6, this restores the same store shape as {@link resetPreviewScenario}
 * because {@link initialPartyPreviewScenarioState} is synchronized-by-default with no
 * overrides. Kept as a separate entry point for the toolbar «Синхронизировать с эфиром»
 * affordance vs expanded-panel «Сброс сценария».
 */
export function syncPreviewWithProduction(): void {
  resetPreviewScenario();
}

/** Enter detached mode without changing current overrides. */
export function detachPreview(): void {
  usePartyPreviewScenarioStore.setState({ isSynchronized: false });
}

export function setPreviewLifecycleOverride(lifecycle: PartyLifecycleState): void {
  usePartyPreviewScenarioStore.setState({
    isSynchronized: false,
    lifecycleOverride: lifecycle,
    mockLiveEnabled: false,
    viewerStatusOverride: null,
    currentTrackNumber: null,
  });
}

export function setPreviewMockLive(): void {
  usePartyPreviewScenarioStore.setState({
    isSynchronized: false,
    lifecycleOverride: 'ready',
    mockLiveEnabled: true,
    viewerStatusOverride: null,
  });
  ensurePreviewTrackNumberSelected();
}

export function setPreviewTrackNumber(trackNumber: number | null): void {
  const normalized =
    trackNumber == null || Number.isNaN(trackNumber) ? null : Math.max(1, Math.floor(trackNumber));
  usePartyPreviewScenarioStore.setState({
    isSynchronized: false,
    lifecycleOverride: 'ready',
    viewerStatusOverride: null,
    mockLiveEnabled: true,
    currentTrackNumber: normalized ?? 1,
  });
}

export function setPreviewConnectionBreak(scenario: PreviewConnectionScenario): void {
  usePartyPreviewScenarioStore.setState({
    isSynchronized: false,
    lifecycleOverride: 'ready',
    mockLiveEnabled: true,
    viewerStatusOverride: PREVIEW_CONNECTION_VIEWER_STATUS[scenario],
  });
  ensurePreviewTrackNumberSelected();
}

export function setPreviewTheme(themeId: PartyThemeId): void {
  const store = getScenarioStore();
  const customizationSettingsOverride =
    store.customizationSettingsOverride ??
    (getDefaultCustomizationSettings(themeId) as Record<string, unknown>);

  usePartyPreviewScenarioStore.setState({
    isSynchronized: false,
    themeOverride: themeId,
    customizationSettingsOverride,
  });
}

export function setPreviewCustomizationSettings(settings: Record<string, unknown>): void {
  usePartyPreviewScenarioStore.setState({
    isSynchronized: false,
    customizationSettingsOverride: settings,
  });
}

/**
 * Restore full initial scenario state (`isSynchronized: true`, all overrides cleared).
 *
 * Intentionally equivalent to {@link syncPreviewWithProduction} on the scenario store
 * per reset matrix §6; differs only in UI context (explicit reset vs sync toggle).
 * Does not mutate production `partyWorkspaceStore`.
 */
export function resetPreviewScenario(): void {
  usePartyPreviewScenarioStore.setState({ ...initialPartyPreviewScenarioState });
}

export type { PreviewConnectionScenario };
