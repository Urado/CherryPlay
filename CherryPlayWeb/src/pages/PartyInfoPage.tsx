/**
 * Страница информации о вечеринке (описание, место, дата).
 * Использует тематический компонент PartyInfoDisplay из библиотеки компонентов.
 */
import {
  Button,
  ButtonLink,
  getDefaultTimeZone,
  PartyInfoDisplay,
  isValidPartyTheme,
} from '@cherryplay/components';
import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';

import { ROUTES } from '../constants/routes';
import { useAppConfig } from '../contexts/AppConfigContext';
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
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="party-info-page-nav-btn"
              onClick={() => navigate(-1)}
              title="Список вечеринок"
            >
              ← Список вечеринок
            </Button>
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
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="party-info-page-nav-btn"
              onClick={() => navigate(-1)}
              title="Список вечеринок"
            >
              ← Список вечеринок
            </Button>
          </div>
        </div>
        <p className="party-info-error">{error ?? 'Вечеринка не найдена'}</p>
        <Button
          type="button"
          variant="secondary"
          className="party-info-page-nav-btn"
          onClick={() => navigate(ROUTES.HOME)}
        >
          На главную
        </Button>
      </div>
    );
  }

  const themeId = isValidPartyTheme(party.partyThemeId) ? party.partyThemeId : 'basic';

  return (
    <div className="party-info-page" data-theme={themeId}>
      <div className="party-info-page-header">
        <div className="party-info-page-header-controls">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="party-info-page-nav-btn"
            onClick={() => navigate(-1)}
            title="Список вечеринок"
          >
            ← Список вечеринок
          </Button>
          <ButtonLink
            href={ROUTES.PARTY_VIEW(shortCode)}
            onClick={(event) => {
              if (event.defaultPrevented) return;
              if (event.button !== 0) return;
              if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

              const target = event.currentTarget.getAttribute('target');
              if (target && target.toLowerCase() !== '_self') return;

              event.preventDefault();
              navigate(ROUTES.PARTY_VIEW(shortCode));
            }}
            className="party-info-page-nav-btn party-info-page-playlist-btn"
            title="Плейлист"
            variant="secondary"
            size="sm"
          >
            Плейлист
          </ButtonLink>
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
  const { partyInfoPageEnabled } = useAppConfig();

  if (!shortCode) {
    return (
      <div className="party-info-page">
        <p>Не указан код вечеринки.</p>
      </div>
    );
  }

  if (!partyInfoPageEnabled) {
    return <Navigate to={ROUTES.PARTY_VIEW(shortCode)} replace />;
  }

  return <PartyInfoContent key={shortCode} shortCode={shortCode} />;
}
