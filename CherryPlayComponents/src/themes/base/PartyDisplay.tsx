import React from 'react';

import { usePartyThemeVars } from '../../core/hooks/usePartyThemeVars';
import { findTrack } from '../../core/utils/playlist';
import { PartyDisplayData } from '../../types';

import { CurrentTrackDisplay } from './CurrentTrackDisplay';
import { PlaylistView } from './PlaylistView';
import '../../components/PartyDisplay/PartyDisplay.css';

function canShowCurrentTrack(data: PartyDisplayData): boolean {
  const state = data.playbackState;
  if (!state?.currentTrackId) return false;
  const track = findTrack(data.playlist.items, state.currentTrackId);
  return track != null && track.type === 'track';
}

export interface BasePartyDisplayProps {
  data: PartyDisplayData;
  className?: string;
  showPlayer?: boolean;
}

export const PartyDisplay: React.FC<BasePartyDisplayProps> = ({
  data,
  className = '',
  showPlayer = true,
}) => {
  const themeVars = usePartyThemeVars(data.themeId, data.customizationSettings);

  return (
    <div className={`party-display ${className}`} data-theme={data.themeId} style={themeVars}>
      <div className="party-display-header">
        <h1 className="party-display-title">{data.partyName}</h1>
      </div>
      <div className="party-display-container">
        {showPlayer && canShowCurrentTrack(data) && (
          <div className="party-display-player">
            <CurrentTrackDisplay
              playbackState={data.playbackState || null}
              playlist={data.playlist}
              themeId={data.themeId}
            />
          </div>
        )}
        <div className="party-display-playlist">
          <PlaylistView
            playlist={data.playlist}
            currentTrackId={data.playbackState?.currentTrackId || null}
            playedTrackIds={data.playbackState?.playedTrackIds || []}
            disabledTrackIds={data.playbackState?.disabledTrackIds || []}
            disabledGroupIds={data.playbackState?.disabledGroupIds || []}
            themeId={data.themeId}
          />
        </div>
      </div>
    </div>
  );
};
