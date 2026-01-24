import React from 'react';

import { useThemeVars } from '../../core/hooks/useThemeVars';
import { PartyDisplayData } from '../../types';

import { CurrentTrackDisplay } from './CurrentTrackDisplay';
import { PlaylistView } from './PlaylistView';
import '../../components/PartyDisplay/PartyDisplay.css';

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
  const themeVars = useThemeVars(data.themeId, data.customizationSettings);

  return (
    <div className={`party-display ${className}`} data-theme={data.themeId} style={themeVars}>
      <div className="party-display-header">
        <h1 className="party-display-title">{data.partyName}</h1>
        {data.isSessionActive && (
          <div className="party-display-session-indicator" title="Сессия активна">
            <span className="party-display-session-dot"></span>
            <span className="party-display-session-text">В эфире</span>
          </div>
        )}
      </div>
      <div className="party-display-container">
        {showPlayer && (data.isSessionActive || data.playbackState) && (
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
