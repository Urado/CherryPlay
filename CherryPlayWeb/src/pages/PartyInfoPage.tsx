/**
 * Страница информации о вечеринке (описание, место, дата).
 * Использует тематический компонент PartyInfoDisplay из библиотеки компонентов.
 */
import { getDefaultTimeZone, PartyInfoDisplay, isValidPartyTheme } from '@cherryplay/components';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { ROUTES } from '../constants/routes';
import { partyApiService } from '../services/partyApiService';
import type { PublicPartyDto } from '../types/api';
import './PartyInfoPage.css';

function PartyInfoContent({ shortCode }: { shortCode: string }) {
  const navigate = useNavigate();
  const [party, setParty] = useState<PublicPartyDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    partyApiService
      .getPublicParty(shortCode)
      .then((data) => {
        if (!cancelled) setParty(data);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Вечеринка не найдена');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [shortCode]);

  if (loading) {
    return (
      <div className="party-info-page">
        <div className="party-info-page-header">
          <div className="party-info-page-header-controls">
            <button
              type="button"
              className="party-info-page-back-btn"
              onClick={() => navigate(-1)}
              title="Список вечеринок"
            >
              ← Список вечеринок
            </button>
          </div>
        </div>
        <p>Загрузка…</p>
      </div>
    );
  }

  if (error || !party) {
    return (
      <div className="party-info-page">
        <div className="party-info-page-header">
          <div className="party-info-page-header-controls">
            <button
              type="button"
              className="party-info-page-back-btn"
              onClick={() => navigate(-1)}
              title="Список вечеринок"
            >
              ← Список вечеринок
            </button>
          </div>
        </div>
        <p className="party-info-error">{error ?? 'Вечеринка не найдена'}</p>
        <button type="button" onClick={() => navigate(ROUTES.HOME)}>
          На главную
        </button>
      </div>
    );
  }

  const themeId = isValidPartyTheme(party.partyThemeId) ? party.partyThemeId : 'basic';

  return (
    <div className="party-info-page" data-theme={themeId}>
      <div className="party-info-page-header">
        <div className="party-info-page-header-controls">
          <button
            type="button"
            className="party-info-page-back-btn"
            onClick={() => navigate(-1)}
            title="Список вечеринок"
          >
            ← Список вечеринок
          </button>
          <a
            href={ROUTES.PARTY_VIEW(shortCode)}
            className="party-info-page-playlist-btn"
            title="Плейлист"
          >
            Плейлист
          </a>
        </div>
      </div>
      <PartyInfoDisplay
        data={{
          partyName: party.name,
          description: party.description,
          eventDateTime: party.eventDateTime,
          place: party.place,
          city: party.city,
          schedule: party.schedule,
          timeZone: party.timeZone ?? getDefaultTimeZone(),
          themeId,
          customizationSettings: party.customizationSettings,
        }}
      />
    </div>
  );
}

export function PartyInfoPage() {
  const { shortCode } = useParams<{ shortCode: string }>();

  if (!shortCode) {
    return (
      <div className="party-info-page">
        <p>Не указан код вечеринки.</p>
      </div>
    );
  }

  return <PartyInfoContent key={shortCode} shortCode={shortCode} />;
}
