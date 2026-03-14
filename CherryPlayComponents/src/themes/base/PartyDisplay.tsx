import React from 'react';

import { usePartyThemeVars } from '../../core/hooks/usePartyThemeVars';
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
  const themeVars = usePartyThemeVars(data.themeId, data.customizationSettings);

  return (
    <div className={`party-display ${className}`} data-theme={data.themeId} style={themeVars}>
      <main className="party-display-main">
        <div className="party-display-header">
          <div className="party-display-header-text">
            <h1 className="party-display-title">{data.partyName}</h1>
            {data.subtitle && <p className="party-display-subtitle">{data.subtitle}</p>}
            <div
              className="party-display-session-indicator"
              role="status"
              aria-live="polite"
              aria-label={data.isSessionActive ? 'Вечеринка идёт' : 'Скоро начнём'}
            >
              <span className="party-display-session-dot" />
              <span className="party-display-session-label">
                {data.isSessionActive ? 'Вечеринка идёт' : 'Скоро начнём'}
              </span>
            </div>
          </div>
        </div>
        <div className="party-display-container">
          {showPlayer && (
            <div className="party-display-player">
              <CurrentTrackDisplay
                playbackState={data.playbackState || null}
                playlist={data.playlist}
                themeId={data.themeId}
              />
            </div>
          )}
          <div className="party-display-playlist-wrapper">
            <div className="party-display-playlist">
              <PlaylistView
                playlist={data.playlist}
                currentTrackId={data.playbackState?.currentTrackId || null}
                playedTrackIds={data.playbackState?.playedTrackIds || []}
                disabledTrackIds={data.playbackState?.disabledTrackIds || []}
                disabledGroupIds={data.playbackState?.disabledGroupIds || []}
                isSessionActive={data.isSessionActive}
                themeId={data.themeId}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
