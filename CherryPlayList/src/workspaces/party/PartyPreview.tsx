import React, { useMemo } from 'react';

import { PartyDisplay, PartyDisplayData, PartyPlaylistData, PlaybackState } from '@cherryplay/components';

import './PartyPreview.css';

interface PartyPreviewProps {
  playlist: PartyPlaylistData;
  styleId: string;
  customizationSettings?: Record<string, any>;
  playbackState?: PlaybackState | null;
  partyName?: string;
  partyId?: string;
}

export const PartyPreview: React.FC<PartyPreviewProps> = ({
  playlist,
  styleId,
  customizationSettings = {},
  playbackState = null,
  partyName = 'Превью вечеринки',
  partyId = 'preview',
}) => {
  // Формируем единый объект данных для PartyDisplay
  const displayData: PartyDisplayData = useMemo(() => ({
    partyId,
    partyName,
    themeId: styleId,
    customizationSettings,
    playlist,
    playbackState: playbackState || null,
    isSessionActive: playbackState !== null,
  }), [partyId, partyName, styleId, customizationSettings, playlist, playbackState]);

  return (
    <div className="party-preview">
      <PartyDisplay data={displayData} showPlayer={playbackState !== null} />
    </div>
  );
};

