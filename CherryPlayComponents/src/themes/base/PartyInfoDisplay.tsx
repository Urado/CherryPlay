import React from 'react';

import { useThemeVars } from '../../core/hooks/useThemeVars';
import type { ThemeId } from '../index';

export interface PartyInfoDisplayData {
  partyName: string;
  description?: string | null;
  eventDateTime?: string | null;
  place?: string | null;
  city?: string | null;
  schedule?: string | null;
  timeZone?: string | null;
  themeId: ThemeId;
  customizationSettings?: Record<string, string | number>;
}

export interface BasePartyInfoDisplayProps {
  data: PartyInfoDisplayData;
  className?: string;
  onGoToPlaylist?: () => void;
  onGoToCatalog?: () => void;
}

export const PartyInfoDisplay: React.FC<BasePartyInfoDisplayProps> = ({
  data,
  className = '',
  onGoToPlaylist,
  onGoToCatalog,
}) => {
  const themeVars = useThemeVars(data.themeId, data.customizationSettings);

  const eventDate = data.eventDateTime
    ? new Intl.DateTimeFormat('ru-RU', {
        dateStyle: 'long',
        timeStyle: 'short',
        timeZone: data.timeZone || undefined,
      }).format(new Date(data.eventDateTime))
    : null;

  return (
    <div className={`party-info-display ${className}`} data-theme={data.themeId} style={themeVars}>
      <div className="party-info-display-container">
        <h1 className="party-info-display-title">{data.partyName}</h1>

        {data.description && (
          <section className="party-info-display-section">
            <p className="party-info-display-description">{data.description}</p>
          </section>
        )}

        <section className="party-info-display-meta">
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

        <div className="party-info-display-actions">
          {onGoToPlaylist && (
            <button type="button" className="party-info-display-link-btn" onClick={onGoToPlaylist}>
              Перейти к плейлисту
            </button>
          )}
          {onGoToCatalog && (
            <button type="button" className="party-info-display-link-back" onClick={onGoToCatalog}>
              Назад к каталогу
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
