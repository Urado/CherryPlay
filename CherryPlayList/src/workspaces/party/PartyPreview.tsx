import {
  PartyDisplay,
  PartyDisplayData,
  PartyPlaylistData,
  PlaybackState,
  partyViewerStatusFromId,
  type PartyThemeId,
  type CustomizationSettings,
  type PartyViewerStatusId,
} from '@cherryplay/components';
import React, { useMemo } from 'react';

import type { PartyLifecycleState } from '@shared/services/partyService';

import { isPlaybackLiveActive, resolvePreviewViewerStatusId } from './partyPreviewLifecycle';

import './PartyPreview.css';

interface PartyPreviewProps {
  playlist: PartyPlaylistData;
  themeId: PartyThemeId;
  customizationSettings?: CustomizationSettings<PartyThemeId>;
  playbackState?: PlaybackState | null;
  partyName?: string;
  subtitle?: string;
  partyId?: string;
  /** Server lifecycle; unlinked/draft → draft viewer status. */
  previewLifecycleState?: PartyLifecycleState | null;
  /** Demo-only: force viewer status (e.g. connection break). */
  previewViewerStatusOverride?: PartyViewerStatusId | null;
}

export const PartyPreview: React.FC<PartyPreviewProps> = ({
  playlist,
  themeId,
  customizationSettings = {},
  playbackState = null,
  partyName = 'Как видят гости',
  subtitle,
  partyId = 'preview',
  previewLifecycleState = null,
  previewViewerStatusOverride = null,
}) => {
  const viewerStatusId =
    previewViewerStatusOverride ??
    resolvePreviewViewerStatusId(playbackState, previewLifecycleState);

  const displayData: PartyDisplayData<PartyThemeId> = useMemo(
    () => ({
      partyId,
      partyName,
      subtitle: subtitle ?? undefined,
      themeId,
      customizationSettings: customizationSettings as
        | CustomizationSettings<PartyThemeId>
        | undefined,
      playlist,
      playbackState: playbackState || null,
      isSessionActive: isPlaybackLiveActive(playbackState),
      viewerStatus: partyViewerStatusFromId(viewerStatusId),
    }),
    [
      partyId,
      partyName,
      subtitle,
      themeId,
      customizationSettings,
      playlist,
      playbackState,
      viewerStatusId,
    ],
  );

  return (
    <div className="party-preview">
      <PartyDisplay data={displayData} showPlayer={isPlaybackLiveActive(playbackState)} />
    </div>
  );
};
