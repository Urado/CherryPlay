import React from 'react';

import { usePartyThemeVars } from '../../core/hooks/usePartyThemeVars';
import { findTrack } from '../../core/utils/playlist';
import { PartyDisplayData } from '../../types';

import { CurrentTrackDisplay } from './CurrentTrackDisplay';
import { FloatingPetals } from './FloatingPetals';
import { PlaylistView } from './PlaylistView';
import '../../components/PartyDisplay/PartyDisplay.css';

/** URL постера темы: ресурс из public/images/ приложения (копируется в контейнер при сборке). */
const SPRING_CROSS_STEP_POSTER_SRC = '/images/spring-cross-step-poster.jpg';

function canShowCurrentTrack(data: PartyDisplayData): boolean {
  const state = data.playbackState;
  if (!state?.currentTrackId) return false;
  const track = findTrack(data.playlist.items, state.currentTrackId);
  return track != null && track.type === 'track';
}

export interface SpringCrossStepPartyDisplayProps {
  data: PartyDisplayData;
  className?: string;
  showPlayer?: boolean;
}

/**
 * PartyDisplay for spring-cross-step theme.
 * Layout from reference: centered header with poster (fixed resource URL), title, subtitle, session;
 * then player; then playlist in a card. Floating petals on background.
 */
export const PartyDisplay: React.FC<SpringCrossStepPartyDisplayProps> = ({
  data,
  className = '',
  showPlayer = true,
}) => {
  const themeVars = usePartyThemeVars(data.themeId, data.customizationSettings);
  const title = data.partyName;
  const subtitle = data.subtitle ?? null;
  const [posterError, setPosterError] = React.useState(false);

  return (
    <div
      className={`party-display party-display--spring-cross-step ${className}`}
      data-theme={data.themeId}
      style={themeVars}
    >
      <FloatingPetals />
      <main className="party-display-main party-display-main--spring-cross-step">
        <header className="party-display-header party-display-header--spring-cross-step">
          <div
            className={
              posterError
                ? 'party-display-poster party-display-poster-placeholder'
                : 'party-display-poster'
            }
          >
            {!posterError && (
              <img
                src={SPRING_CROSS_STEP_POSTER_SRC}
                alt=""
                className="party-display-poster-img"
                onError={() => setPosterError(true)}
              />
            )}
          </div>
          <div className="party-display-header-text">
            <h1 className="party-display-title party-display-title--spring-cross-step">{title}</h1>
            {subtitle && <p className="party-display-subtitle">{subtitle}</p>}
            <div className="party-display-session-indicator">
              <span className="party-display-session-dot" />
              <span className="party-display-session-label">
                {data.isSessionActive ? 'Вечеринка идёт' : 'Скоро начнём'}
              </span>
            </div>
          </div>
        </header>

        {showPlayer && canShowCurrentTrack(data) && (
          <div className="party-display-player party-display-player--spring-cross-step">
            <CurrentTrackDisplay
              playbackState={data.playbackState || null}
              playlist={data.playlist}
              themeId={data.themeId}
            />
          </div>
        )}

        <div className="party-display-playlist-wrapper party-display-playlist-wrapper--spring-cross-step">
          <PlaylistView
            playlist={data.playlist}
            currentTrackId={data.playbackState?.currentTrackId ?? null}
            playedTrackIds={data.playbackState?.playedTrackIds ?? []}
            disabledTrackIds={data.playbackState?.disabledTrackIds ?? []}
            disabledGroupIds={data.playbackState?.disabledGroupIds ?? []}
            isSessionActive={data.isSessionActive}
            themeId={data.themeId}
          />
        </div>
      </main>
    </div>
  );
};
