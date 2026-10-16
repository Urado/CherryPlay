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

const getScenarioStore = () => {
  return usePartyPreviewScenarioStore.getState();
};

const ensurePreviewTrackNumberSelected = (): void => {
  const store = getScenarioStore();
  if (store.currentTrackNumber == null || store.currentTrackNumber < 1) {
    usePartyPreviewScenarioStore.setState({ currentTrackNumber: 1 });
  }
};

export const syncPreviewWithProduction = (): void => {
  resetPreviewScenario();
};

export const detachPreview = (): void => {
  usePartyPreviewScenarioStore.setState({ isSynchronized: false });
};

export const setPreviewLifecycleOverride = (lifecycle: PartyLifecycleState): void => {
  usePartyPreviewScenarioStore.setState({
    isSynchronized: false,
    lifecycleOverride: lifecycle,
    mockLiveEnabled: false,
    viewerStatusOverride: null,
    currentTrackNumber: null,
  });
};

export const setPreviewMockLive = (): void => {
  usePartyPreviewScenarioStore.setState({
    isSynchronized: false,
    lifecycleOverride: 'ready',
    mockLiveEnabled: true,
    viewerStatusOverride: null,
  });
  ensurePreviewTrackNumberSelected();
};

export const setPreviewTrackNumber = (trackNumber: number | null): void => {
  const normalized =
    trackNumber == null || Number.isNaN(trackNumber) ? null : Math.max(1, Math.floor(trackNumber));
  usePartyPreviewScenarioStore.setState({
    isSynchronized: false,
    lifecycleOverride: 'ready',
    viewerStatusOverride: null,
    mockLiveEnabled: true,
    currentTrackNumber: normalized ?? 1,
  });
};

export const setPreviewConnectionBreak = (scenario: PreviewConnectionScenario): void => {
  usePartyPreviewScenarioStore.setState({
    isSynchronized: false,
    lifecycleOverride: 'ready',
    mockLiveEnabled: true,
    viewerStatusOverride: PREVIEW_CONNECTION_VIEWER_STATUS[scenario],
  });
  ensurePreviewTrackNumberSelected();
};

export const setPreviewTheme = (themeId: PartyThemeId): void => {
  const store = getScenarioStore();
  const customizationSettingsOverride =
    store.customizationSettingsOverride ??
    (getDefaultCustomizationSettings(themeId));

  usePartyPreviewScenarioStore.setState({
    isSynchronized: false,
    themeOverride: themeId,
    customizationSettingsOverride,
  });
};

export const setPreviewCustomizationSettings = (settings: Record<string, unknown>): void => {
  usePartyPreviewScenarioStore.setState({
    isSynchronized: false,
    customizationSettingsOverride: settings,
  });
};

export const resetPreviewScenario = (): void => {
  usePartyPreviewScenarioStore.setState({ ...initialPartyPreviewScenarioState });
};

export type { PreviewConnectionScenario };
