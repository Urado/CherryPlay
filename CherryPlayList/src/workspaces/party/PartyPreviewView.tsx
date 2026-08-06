import { partyThemes, type CustomizationSettings, type PartyThemeId } from '@cherryplay/components';
import React, { useMemo } from 'react';

import { WorkspaceId } from '@core/types/workspace';
import { useProjectStore } from '@shared/stores/projectStore';
import { useOnlineNetworkPolicy } from '@shared/streaming';

import { PartyConnectivityBanner } from './components/PartyConnectivityBanner';
import { PartyPreview } from './PartyPreview';
import { usePartyPreviewEffectiveState } from './partyPreviewEffectiveState';
import { PartyWorkspaceDemoPanel } from './PartyWorkspaceDemoPanel';
import './PartyPreviewView.css';
import { usePartyWorkspaceRuntimeContext } from './partyWorkspaceRuntimeContext';
import { resolveDisplayPartyName } from './partyWorkspaceUtils';

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
  const runtime = usePartyWorkspaceRuntimeContext();
  const { networkEnabled } = useOnlineNetworkPolicy();
  const {
    partyName,
    partyTitle,
    partySubtitle,
    themeId,
    customizationSettings,
    playbackState,
    partyLifecycleState,
    visibleThemeIds,
    meta,
    previewPlaylistData,
    serverUnreachable,
    isReconnecting,
    lastManualCheckFailed,
    handleManualReconnect,
  } = runtime;
  const projectName = useProjectStore((state) => state.name);
  const displayPartyName = useMemo(() => {
    const title = partyTitle.trim();
    if (title.length > 0) {
      return title;
    }
    return resolveDisplayPartyName(partyName, projectName, 'Как видят гости');
  }, [partyTitle, partyName, projectName]);

  const {
    isSynchronized,
    previewLifecycleState,
    effectivePlaybackState,
    previewViewerStatusOverride,
    effectiveThemeId,
    effectiveCustomizationSettings,
    isEffectiveThemeUnavailable,
    previewTrackIds,
  } = usePartyPreviewEffectiveState({
    production: {
      themeId,
      customizationSettings,
      playbackState,
      partyLifecycleState,
      isLinked: meta.linkedParty != null,
    },
    previewPlaylistData,
    visibleThemeIds,
  });

  const availableThemeSet = useMemo(
    () => (visibleThemeIds ? new Set(visibleThemeIds) : null),
    [visibleThemeIds],
  );
  const previewDesignOptions = useMemo(
    () =>
      partyThemes.map((theme) => ({
        id: theme.id,
        name: theme.name,
        isAvailable: availableThemeSet ? availableThemeSet.has(theme.id) : true,
      })),
    [availableThemeSet],
  );

  const playbackContext = useMemo(
    () => ({
      isSynchronized,
      previewLifecycleState,
      effectivePlaybackState,
    }),
    [isSynchronized, previewLifecycleState, effectivePlaybackState],
  );

  return (
    <div className="party-preview-view">
      {!networkEnabled && <PartyConnectivityBanner kind="offline" />}
      {networkEnabled && serverUnreachable && (
        <PartyConnectivityBanner
          kind="unreachable"
          isReconnecting={isReconnecting}
          lastManualCheckFailed={lastManualCheckFailed}
          onManualReconnect={handleManualReconnect}
        />
      )}
      <div className="party-preview-view-header">
        <h2>Превью (как будет выглядеть в браузере)</h2>
        <span
          className={`party-preview-view-sync-badge ${
            isSynchronized
              ? 'party-preview-view-sync-badge--synced'
              : 'party-preview-view-sync-badge--detached'
          }`}
        >
          {isSynchronized ? 'Синхронизировано' : 'Локальный сценарий'}
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
          partyName={displayPartyName}
          subtitle={partySubtitle.trim() || undefined}
          previewLifecycleState={previewLifecycleState}
          previewViewerStatusOverride={previewViewerStatusOverride}
        />
      </div>
      <PartyWorkspaceDemoPanel
        mode="preview"
        previewTrackIds={previewTrackIds}
        playbackContext={playbackContext}
        previewThemeId={effectiveThemeId}
        previewDesignOptions={previewDesignOptions}
        previewCustomizationSettings={effectiveCustomizationSettings}
        showDemoReset={showDemoPanel}
      />
    </div>
  );
};
