import { partyThemes, type CustomizationSettings, type PartyThemeId } from '@cherryplay/components';
import React, { useMemo } from 'react';

import { WorkspaceId } from '@core/types/workspace';
import { collectComponentPlaylistTrackIds } from '@shared/utils';

import { PartyPreview } from './PartyPreview';
import { DEMO_MOCK_LIVE_PLAYBACK } from './partyWorkspaceDemoActions';
import { PartyWorkspaceDemoPanel } from './PartyWorkspaceDemoPanel';
import { usePartyWorkspaceStore } from './partyWorkspaceStore';
import './PartyPreviewView.css';
import { usePartyWorkspaceRuntime } from './usePartyWorkspace';

interface PartyPreviewViewProps {
  workspaceId: WorkspaceId;
  zoneId: string;
  showDemoPanel?: boolean;
}

export const PartyPreviewView: React.FC<PartyPreviewViewProps> = ({
  workspaceId: _workspaceId,
  zoneId: _zoneId,
  showDemoPanel = false,
}) => {
  const {
    partyName,
    partyTitle,
    partySubtitle,
    themeId,
    customizationSettings,
    previewPlaylistData,
    playbackState,
    partyLifecycleState,
    visibleThemeIds,
    meta,
  } = usePartyWorkspaceRuntime();

  const demoPreviewLive = usePartyWorkspaceStore((state) => state.demoPreviewLive);
  const demoPreviewViewerStatusOverride = usePartyWorkspaceStore(
    (state) => state.demoPreviewViewerStatusOverride,
  );
  const previewLifecycleOverride = usePartyWorkspaceStore(
    (state) => state.previewLifecycleOverride,
  );
  const previewCurrentTrackNumber = usePartyWorkspaceStore(
    (state) => state.previewCurrentTrackNumber,
  );
  const previewThemeOverride = usePartyWorkspaceStore((state) => state.previewThemeOverride);
  const previewCustomizationSettingsOverride = usePartyWorkspaceStore(
    (state) => state.previewCustomizationSettingsOverride,
  );
  const isPreviewSynchronized = usePartyWorkspaceStore((state) => state.isPreviewSynchronized);

  const previewTrackIds = useMemo(
    () => collectComponentPlaylistTrackIds(previewPlaylistData.items),
    [previewPlaylistData.items],
  );

  const runtimeLifecycleState = meta.linkedParty ? partyLifecycleState : null;
  const previewLifecycleState = isPreviewSynchronized
    ? runtimeLifecycleState
    : previewLifecycleOverride;
  const effectivePlaybackState = useMemo(() => {
    if (isPreviewSynchronized) {
      return playbackState;
    }

    const hasLocalPlayback =
      demoPreviewLive ||
      demoPreviewViewerStatusOverride != null ||
      previewCurrentTrackNumber != null;
    if (!hasLocalPlayback) {
      return null;
    }

    const safeTrackNumber = Math.max(1, previewCurrentTrackNumber ?? 1);
    const boundedTrackNumber =
      previewTrackIds.length > 0
        ? Math.min(safeTrackNumber, previewTrackIds.length)
        : safeTrackNumber;
    const currentTrackId =
      previewTrackIds[boundedTrackNumber - 1] ??
      previewTrackIds[0] ??
      DEMO_MOCK_LIVE_PLAYBACK.currentTrackId;
    const isConnectionBreak = demoPreviewViewerStatusOverride != null;

    return {
      ...DEMO_MOCK_LIVE_PLAYBACK,
      currentTrackId,
      status: isConnectionBreak ? 'paused' : 'playing',
      lastUpdatedAt: new Date().toISOString(),
    };
  }, [
    isPreviewSynchronized,
    playbackState,
    demoPreviewLive,
    demoPreviewViewerStatusOverride,
    previewCurrentTrackNumber,
    previewTrackIds,
  ]);
  const previewViewerStatusOverride = isPreviewSynchronized
    ? null
    : demoPreviewViewerStatusOverride;
  const effectiveThemeId = isPreviewSynchronized ? themeId : (previewThemeOverride ?? themeId);
  const effectiveCustomizationSettings = isPreviewSynchronized
    ? customizationSettings
    : (previewCustomizationSettingsOverride ?? customizationSettings);
  const availableThemeSet = useMemo(
    () => (visibleThemeIds ? new Set(visibleThemeIds) : null),
    [visibleThemeIds],
  );
  const isEffectiveThemeUnavailable = availableThemeSet
    ? !availableThemeSet.has(effectiveThemeId)
    : false;
  const previewDesignOptions = useMemo(
    () =>
      partyThemes.map((theme) => ({
        id: theme.id,
        name: theme.name,
        isAvailable: availableThemeSet ? availableThemeSet.has(theme.id) : true,
      })),
    [availableThemeSet],
  );

  return (
    <div className="party-preview-view">
      <div className="party-preview-view-header">
        <h2>Превью (как будет выглядеть в браузере)</h2>
        <span
          className={`party-preview-view-sync-badge ${
            isPreviewSynchronized
              ? 'party-preview-view-sync-badge--synced'
              : 'party-preview-view-sync-badge--detached'
          }`}
        >
          {isPreviewSynchronized ? 'Синхронизировано' : 'Локальный сценарий'}
        </span>
        {isEffectiveThemeUnavailable && (
          <span className="party-preview-view-sync-badge party-preview-view-sync-badge--warning">
            Недоступный дизайн
          </span>
        )}
      </div>
      <div className="party-preview-view-content">
        <PartyPreview
          playlist={previewPlaylistData}
          themeId={effectiveThemeId}
          customizationSettings={
            effectiveCustomizationSettings as CustomizationSettings<PartyThemeId>
          }
          playbackState={effectivePlaybackState}
          partyName={partyTitle.trim() || partyName || 'Превью вечеринки'}
          subtitle={partySubtitle.trim() || undefined}
          previewLifecycleState={previewLifecycleState}
          previewViewerStatusOverride={previewViewerStatusOverride}
        />
      </div>
      {showDemoPanel && (
        <PartyWorkspaceDemoPanel
          mode="preview"
          previewTrackCount={previewTrackIds.length}
          previewThemeId={effectiveThemeId}
          previewDesignOptions={previewDesignOptions}
          previewCustomizationSettings={effectiveCustomizationSettings}
        />
      )}
    </div>
  );
};
