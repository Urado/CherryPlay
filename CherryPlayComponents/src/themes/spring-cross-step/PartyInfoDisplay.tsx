import React from 'react';

import { usePartyThemeVars } from '../../core/hooks/usePartyThemeVars';
import { getDefaultTimeZone } from '../../utils/timezoneUtils';
import type { PartyThemeId } from '../index';

import { FloatingPetals } from './FloatingPetals';
import '../../components/PartyDisplay/PartyDisplay.css';

const SPRING_CROSS_STEP_POSTER_SRC = new URL('./spring-cross-step-poster.jpg', import.meta.url)
  .href;

export interface PartyInfoDisplayData {
  partyName: string;
  description?: string | null;
  eventDateTime?: string | null;
  place?: string | null;
  city?: string | null;
  schedule?: string | null;
  timeZone?: string | null;
  themeId: PartyThemeId;
  customizationSettings?: Record<string, string | number>;
}

export interface SpringCrossStepPartyInfoDisplayProps {
  data: PartyInfoDisplayData;
  className?: string;
}

export const PartyInfoDisplay: React.FC<SpringCrossStepPartyInfoDisplayProps> = ({
  data,
  className = '',
}) => {
  const themeVars = usePartyThemeVars(data.themeId, data.customizationSettings);
  const [posterError, setPosterError] = React.useState(false);

  const eventDate = data.eventDateTime
    ? new Intl.DateTimeFormat('ru-RU', {
        dateStyle: 'long',
        timeStyle: 'short',
        timeZone: data.timeZone || getDefaultTimeZone(),
      }).format(new Date(data.eventDateTime))
    : null;

  return (
    <div
      className={`party-display party-display--spring-cross-step party-info-display--spring-cross-step ${className}`}
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
            <h1 className="party-display-title party-display-title--spring-cross-step">
              {data.partyName}
            </h1>
          </div>
        </header>

        <div className="party-display-playlist-wrapper party-display-playlist-wrapper--spring-cross-step party-info-display-container--spring-cross-step">
          <div className="party-info-display-inner">
            {(eventDate || data.place || data.city || data.schedule) && (
              <section className="party-info-display-meta party-info-display-meta--top">
                {eventDate && (
                  <p className="party-info-display-date">
                    <strong>Дата и время:</strong> {eventDate}
                  </p>
                )}
                {data.place && (
                  <p className="party-info-display-place">
                    <strong>Место:</strong> {data.place}
                  </p>
                )}
                {data.city && (
                  <p className="party-info-display-city">
                    <strong>Город:</strong> {data.city}
                  </p>
                )}
                {data.schedule && (
                  <p className="party-info-display-schedule">
                    <strong>Расписание:</strong> {data.schedule}
                  </p>
                )}
              </section>
            )}

            {data.description && (
              <section className="party-info-display-section">
                <p className="party-info-display-description">{data.description}</p>
              </section>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};
