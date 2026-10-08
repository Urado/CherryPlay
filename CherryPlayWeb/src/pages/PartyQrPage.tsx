import {
  DEFAULT_PARTY_THEME_ID,
  isValidPartyTheme,
  PartyQrCode,
  resolvePartyQrImage,
  resolvePartyQrStyle,
  usePartyThemeVars,
} from '@cherryplay/components';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { SiteFooter } from '../components/SiteFooter';
import { ROUTES } from '../constants/routes';
import { partyApiService } from '../services/partyApiService';
import type { PublicPartyDto } from '../types/api';
import './PartyQrPage.css';

export const PartyQrPage = () => {
  const { shortCode } = useParams<{ shortCode: string }>();
  const [party, setParty] = useState<PublicPartyDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const themeId = party && isValidPartyTheme(party.partyThemeId)
    ? party.partyThemeId
    : DEFAULT_PARTY_THEME_ID;
  const themeVars = usePartyThemeVars(themeId, party?.customizationSettings);

  useEffect(() => {
    if (!shortCode) {
      setError('Не указан код вечеринки.');
      setLoading(false);
      return;
    }

    let cancelled = false;
    partyApiService
      .getPublicParty(shortCode)
      .then((data) => {
        if (!cancelled) setParty(data);
      })
      .catch((reason) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : 'Вечеринка не найдена');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [shortCode]);

  useEffect(() => {
    const displayTitle = party?.title?.trim() || party?.name.trim();
    if (displayTitle) document.title = `QR-код — ${displayTitle}`;
  }, [party]);

  const title = party?.title?.trim() || party?.name || 'Вечеринка';
  const partyUrl = shortCode ? new URL(ROUTES.PARTY_VIEW(shortCode), window.location.origin).toString() : '';

  return (
    <div className="party-qr-page" data-theme={themeId} style={themeVars}>
      <header className="party-qr-page-header">
        {shortCode && (
          <Link to={ROUTES.PARTY_VIEW(shortCode)} className="party-view-back-btn" title="К вечеринке">
            ← К вечеринке
          </Link>
        )}
      </header>
      <main className="party-qr-page-main">
        {loading && <p>Загрузка…</p>}
        {!loading && error && <p className="party-qr-page-error" role="alert">{error}</p>}
        {!loading && !error && party && (
          <>
            <p className="party-qr-page-description">Отсканируйте код, чтобы открыть вечеринку</p>
            <PartyQrCode
              value={partyUrl}
              title={title}
              style={resolvePartyQrStyle(themeId, party?.customizationSettings)}
              logoSrc={resolvePartyQrImage(themeId, party.customizationSettings)}
            />
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
};
