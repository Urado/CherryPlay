/**
 * Страница информации о вечеринке (описание, место, дата).
 * Использует тематический компонент PartyInfoDisplay из библиотеки компонентов.
 */
import { PartyInfoDisplay, isValidTheme } from '@cherryplay/components';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { partyApiService } from '../services/partyApiService';
import type { PublicPartyDto } from '../types/api';

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
        <p>Загрузка…</p>
      </div>
    );
  }

  if (error || !party) {
    return (
      <div className="party-info-page">
        <p className="party-info-error">{error ?? 'Вечеринка не найдена'}</p>
        <button type="button" onClick={() => navigate('/')}>
          На главную
        </button>
      </div>
    );
  }

  const themeId = isValidTheme(party.themeId) ? party.themeId : 'basic';

  return (
    <PartyInfoDisplay
      data={{
        partyName: party.name,
        description: party.description,
        eventDateTime: party.eventDateTime,
        place: party.place,
        city: party.city,
        schedule: party.schedule,
        timeZone: party.timeZone,
        themeId,
        customizationSettings: party.customizationSettings,
      }}
      onGoToPlaylist={() => navigate(`/party/${shortCode}`)}
      onGoToCatalog={() => navigate('/')}
    />
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
