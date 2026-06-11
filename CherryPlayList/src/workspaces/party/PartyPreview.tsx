import {
  PartyDisplay,
  PartyDisplayData,
  PartyPlaylistData,
  PlaybackState,
  partyViewerStatusFromId,
  type PartyThemeId,
  type CustomizationSettings,
} from '@cherryplay/components';
import React, { useMemo } from 'react';

import './PartyPreview.css';

interface PartyPreviewProps {
  playlist: PartyPlaylistData;
  themeId: PartyThemeId;
  customizationSettings?: CustomizationSettings<PartyThemeId>;
  playbackState?: PlaybackState | null;
  partyName?: string;
  subtitle?: string;
  partyId?: string;
}

export const PartyPreview: React.FC<PartyPreviewProps> = ({
  playlist,
  themeId,
  customizationSettings = {},
  playbackState = null,
  partyName = 'Превью вечеринки',
  subtitle,
  partyId = 'preview',
}) => {
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
      isSessionActive: playbackState !== null,
      viewerStatus: partyViewerStatusFromId(playbackState !== null ? 'live' : 'starting_soon'),
    }),
    [partyId, partyName, subtitle, themeId, customizationSettings, playlist, playbackState],
  );

  return (
    <div className="party-preview">
      <PartyDisplay data={displayData} showPlayer={playbackState !== null} />
    </div>
  );
};
