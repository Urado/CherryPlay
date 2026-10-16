import type { PartyThemeId, PartyViewerStatusId } from '@cherryplay/components';
import type { PartyLifecycleState } from '@shared/services/partyService';
import { createWithEqualityFn } from 'zustand/traditional';

export interface PartyPreviewScenarioState {
  isSynchronized: boolean;
  mockLiveEnabled: boolean;
  viewerStatusOverride: PartyViewerStatusId | null;
  lifecycleOverride: PartyLifecycleState | null;
  currentTrackNumber: number | null;
  themeOverride: PartyThemeId | null;
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

export const resetPartyPreviewScenarioStore = (): void => {
  usePartyPreviewScenarioStore.setState({ ...initialPartyPreviewScenarioState });
};
