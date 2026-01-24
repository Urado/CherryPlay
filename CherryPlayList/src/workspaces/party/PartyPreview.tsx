import {
  PartyDisplay,
  PartyDisplayData,
  PartyPlaylistData,
  PlaybackState,
  type ThemeId,
  type CustomizationSettings,
} from '@cherryplay/components';
import React, { useMemo } from 'react';

import './PartyPreview.css';

interface PartyPreviewProps {
  playlist: PartyPlaylistData;
  themeId: ThemeId;
  customizationSettings?: CustomizationSettings<ThemeId>;
  playbackState?: PlaybackState | null;
  partyName?: string;
  partyId?: string;
}

export const PartyPreview: React.FC<PartyPreviewProps> = ({
  playlist,
  themeId,
  customizationSettings = {},
  playbackState = null,
  partyName = 'Превью вечеринки',
  partyId = 'preview',
}) => {
  const displayData: PartyDisplayData<ThemeId> = useMemo(
    () => ({
      partyId,
      partyName,
      themeId,
      customizationSettings: customizationSettings as CustomizationSettings<ThemeId> | undefined,
      playlist,
      playbackState: playbackState || null,
      isSessionActive: playbackState !== null,
    }),
    [partyId, partyName, themeId, customizationSettings, playlist, playbackState],
  );

  return (
    <div className="party-preview">
      <PartyDisplay data={displayData} showPlayer={playbackState !== null} />
    </div>
  );
};
