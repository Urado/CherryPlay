import type { PartyThemeId, PartyViewerStatusId } from '@cherryplay/components';
import { createWithEqualityFn } from 'zustand/traditional';

import type { PartyLifecycleState } from '@shared/services/partyService';

/**
 * Detached preview scenario state — local simulation overrides that do not affect
 * production party form or server state. Default is synchronized with runtime.
 */
export interface PartyPreviewScenarioState {
  /** When true, preview reflects runtime/production; overrides are ignored. */
  isSynchronized: boolean;
  /** Mock live playback in detached preview. */
  mockLiveEnabled: boolean;
  /** Force viewer status in detached preview (e.g. connection-break scenarios). */
  viewerStatusOverride: PartyViewerStatusId | null;
  /** Force lifecycle badge/state in detached preview. */
  lifecycleOverride: PartyLifecycleState | null;
  /** 1-based track number for mock live playback in detached preview. */
  currentTrackNumber: number | null;
  /** Local theme override for design simulations. */
  themeOverride: PartyThemeId | null;
  /** Local customization override for selected preview theme. */
  customizationSettingsOverride: Record<string, unknown> | null;
}

export const initialPartyPreviewScenarioState: PartyPreviewScenarioState = {
  isSynchronized: true,
  mockLiveEnabled: false,
  viewerStatusOverride: null,
  lifecycleOverride: null,
  currentTrackNumber: null,
  themeOverride: null,
  customizationSettingsOverride: null,
};

export const usePartyPreviewScenarioStore = createWithEqualityFn<PartyPreviewScenarioState>(() => ({
  ...initialPartyPreviewScenarioState,
}));

export function resetPartyPreviewScenarioStore(): void {
  usePartyPreviewScenarioStore.setState({ ...initialPartyPreviewScenarioState });
}
