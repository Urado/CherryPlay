import React, { useMemo } from 'react';

import { PartyDisplay, PartyDisplayData, PartyPlaylistData, PlaybackState } from '@cherryplay/components';

import './PartyPreview.css';

interface PartyPreviewProps {
  playlist: PartyPlaylistData;
  themeId: string;
  customizationSettings?: Record<string, any>;
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
  // Формируем единый объект данных для PartyDisplay
  const displayData: PartyDisplayData = useMemo(() => ({
    partyId,
    partyName,
    themeId,
    customizationSettings,
    playlist,
    playbackState: playbackState || null,
    isSessionActive: playbackState !== null,
  }), [partyId, partyName, themeId, customizationSettings, playlist, playbackState]);

  return (
    <div className="party-preview">
      <PartyDisplay data={displayData} showPlayer={playbackState !== null} />
    </div>
  );
};

