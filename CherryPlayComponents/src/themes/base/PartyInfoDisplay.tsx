import React from 'react';

import { usePartyThemeVars } from '../../core/hooks/usePartyThemeVars';
import { getDefaultTimeZone } from '../../utils/timezoneUtils';
import type { PartyThemeId } from '../index';

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

export interface BasePartyInfoDisplayProps {
  data: PartyInfoDisplayData;
  className?: string;
}

export const PartyInfoDisplay: React.FC<BasePartyInfoDisplayProps> = ({ data, className = '' }) => {
  const themeVars = usePartyThemeVars(data.themeId, data.customizationSettings);

  const eventDate = data.eventDateTime
    ? new Intl.DateTimeFormat('ru-RU', {
        dateStyle: 'long',
        timeStyle: 'short',
        timeZone: data.timeZone || getDefaultTimeZone(),
      }).format(new Date(data.eventDateTime))
    : null;

  const hasContentAboveMeta = Boolean(data.description);

  return (
    <div className={`party-info-display ${className}`} data-theme={data.themeId} style={themeVars}>
      <div className="party-info-display-container">
        <div className="party-info-display-inner">
          <h1 className="party-info-display-title">{data.partyName}</h1>

          {data.description && (
            <section className="party-info-display-section">
              <p className="party-info-display-description">{data.description}</p>
            </section>
          )}

          <section
            className={`party-info-display-meta${!hasContentAboveMeta ? ' party-info-display-meta--top' : ''}`}
          >
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
        </div>
      </div>
    </div>
  );
};
