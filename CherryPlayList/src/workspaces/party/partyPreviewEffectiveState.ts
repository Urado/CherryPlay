import type { PartyThemeId, PartyViewerStatusId, PlaybackState } from '@cherryplay/components';
import { useMemo } from 'react';
import { shallow } from 'zustand/shallow';

import type { PartyLifecycleState } from '@shared/services/partyService';
import { collectComponentPlaylistTrackIds } from '@shared/utils';

import { DEMO_MOCK_LIVE_PLAYBACK } from './partyPreviewMockPlayback';
import type { PartyPreviewScenarioState } from './partyPreviewScenarioStore';
import { usePartyPreviewScenarioStore } from './partyPreviewScenarioStore';

export interface PartyPreviewProductionSnapshot {
  themeId: PartyThemeId;
  customizationSettings: Record<string, unknown>;
  playbackState: PlaybackState | null;
  partyLifecycleState: PartyLifecycleState | null;
  isLinked: boolean;
}

export interface PartyPreviewEffectiveState {
  isSynchronized: boolean;
  previewLifecycleState: PartyLifecycleState | null;
  effectivePlaybackState: PlaybackState | null;
  previewViewerStatusOverride: PartyViewerStatusId | null;
  effectiveThemeId: PartyThemeId;
  effectiveCustomizationSettings: Record<string, unknown>;
  isEffectiveThemeUnavailable: boolean;
}

export interface PartyPreviewPlaylistData {
  items: readonly unknown[];
}

export interface PartyPreviewEffectiveStateInput {
  production: PartyPreviewProductionSnapshot;
  previewPlaylistData: PartyPreviewPlaylistData;
  visibleThemeIds: readonly PartyThemeId[] | null;
}

function resolveIsEffectiveThemeUnavailable(
  effectiveThemeId: PartyThemeId,
  visibleThemeIds: readonly PartyThemeId[] | null,
): boolean {
  if (!visibleThemeIds) {
    return false;
  }
  return !visibleThemeIds.includes(effectiveThemeId);
}

export function resolvePartyPreviewEffectiveState(
  production: PartyPreviewProductionSnapshot,
  scenario: PartyPreviewScenarioState,
  previewTrackIds: readonly string[],
  visibleThemeIds: readonly PartyThemeId[] | null,
): PartyPreviewEffectiveState {
  const runtimeLifecycleState = production.isLinked ? production.partyLifecycleState : null;

  if (scenario.isSynchronized) {
    const effectiveThemeId = production.themeId;
    return {
      isSynchronized: true,
      previewLifecycleState: runtimeLifecycleState,
      effectivePlaybackState: production.playbackState,
      previewViewerStatusOverride: null,
      effectiveThemeId,
      effectiveCustomizationSettings: production.customizationSettings,
      isEffectiveThemeUnavailable: resolveIsEffectiveThemeUnavailable(
        effectiveThemeId,
        visibleThemeIds,
      ),
    };
  }

  const previewLifecycleState = scenario.lifecycleOverride;
  const previewViewerStatusOverride = scenario.viewerStatusOverride;
  const effectiveThemeId = scenario.themeOverride ?? production.themeId;
  const effectiveCustomizationSettings =
    scenario.customizationSettingsOverride ?? production.customizationSettings;

  const hasLocalPlayback =
    scenario.mockLiveEnabled ||
    scenario.viewerStatusOverride != null ||
    scenario.currentTrackNumber != null;

  if (!hasLocalPlayback) {
    return {
      isSynchronized: false,
      previewLifecycleState,
      effectivePlaybackState: null,
      previewViewerStatusOverride,
      effectiveThemeId,
      effectiveCustomizationSettings,
      isEffectiveThemeUnavailable: resolveIsEffectiveThemeUnavailable(
        effectiveThemeId,
        visibleThemeIds,
      ),
    };
  }

  const safeTrackNumber = Math.max(1, scenario.currentTrackNumber ?? 1);
  const boundedTrackNumber =
    previewTrackIds.length > 0
      ? Math.min(safeTrackNumber, previewTrackIds.length)
      : safeTrackNumber;
  const currentTrackId =
    previewTrackIds[boundedTrackNumber - 1] ??
    previewTrackIds[0] ??
    DEMO_MOCK_LIVE_PLAYBACK.currentTrackId;
  const isConnectionBreak = scenario.viewerStatusOverride != null;

  return {
    isSynchronized: false,
    previewLifecycleState,
    effectivePlaybackState: {
      ...DEMO_MOCK_LIVE_PLAYBACK,
      currentTrackId,
      status: isConnectionBreak ? 'paused' : 'playing',
      lastUpdatedAt: new Date().toISOString(),
    },
    previewViewerStatusOverride,
    effectiveThemeId,
    effectiveCustomizationSettings,
    isEffectiveThemeUnavailable: resolveIsEffectiveThemeUnavailable(
      effectiveThemeId,
      visibleThemeIds,
    ),
  };
}

export interface PartyPreviewEffectiveStateResult extends PartyPreviewEffectiveState {
  previewTrackIds: readonly string[];
}

function selectPartyPreviewScenarioState(
  state: PartyPreviewScenarioState,
): PartyPreviewScenarioState {
  return {
    isSynchronized: state.isSynchronized,
    mockLiveEnabled: state.mockLiveEnabled,
    viewerStatusOverride: state.viewerStatusOverride,
    lifecycleOverride: state.lifecycleOverride,
    currentTrackNumber: state.currentTrackNumber,
    themeOverride: state.themeOverride,
    customizationSettingsOverride: state.customizationSettingsOverride,
  };
}

export function usePartyPreviewEffectiveState(
  input: PartyPreviewEffectiveStateInput,
): PartyPreviewEffectiveStateResult {
  const { production, previewPlaylistData, visibleThemeIds } = input;
  const scenario = usePartyPreviewScenarioStore(selectPartyPreviewScenarioState, shallow);
  const isSynchronized = scenario.isSynchronized;

  const previewTrackIds = useMemo(
    () => collectComponentPlaylistTrackIds(previewPlaylistData.items),
    [previewPlaylistData.items],
  );

  const productionPlaybackState = isSynchronized ? production.playbackState : null;
  const productionLifecycleState = isSynchronized ? production.partyLifecycleState : null;

  const effectiveState = useMemo(
    () =>
      resolvePartyPreviewEffectiveState(
        {
          themeId: production.themeId,
          customizationSettings: production.customizationSettings,
          playbackState: productionPlaybackState,
          partyLifecycleState: productionLifecycleState,
          isLinked: production.isLinked,
        },
        scenario,
        previewTrackIds,
        visibleThemeIds,
      ),
    [
      production.themeId,
      production.customizationSettings,
      productionPlaybackState,
      productionLifecycleState,
      production.isLinked,
      visibleThemeIds,
      scenario,
      previewTrackIds,
    ],
  );

  return useMemo(
    () => ({
      ...effectiveState,
      previewTrackIds,
    }),
    [effectiveState, previewTrackIds],
  );
}
