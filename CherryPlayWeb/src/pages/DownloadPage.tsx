import { ButtonLink } from '@cherryplay/components';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { ROUTES } from '../constants/routes';
import { getLatestDesktopRelease, type DesktopRelease } from '../services/desktopReleaseService';
import './DownloadPage.css';

export const DownloadPage = () => {
  const [release, setRelease] = useState<DesktopRelease | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    getLatestDesktopRelease()
      .then((latestRelease) => {
        if (active) setRelease(latestRelease);
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setError(
          reason instanceof Error
            ? reason.message
            : 'Не удалось загрузить приложение. Попробуйте позже.',
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="download-page">
      <main className="download-content" aria-labelledby="download-title">
        <Link className="download-back-link" to={ROUTES.HOME}>
          К вечеринкам
        </Link>
        <section className="download-card">
          <p className="download-eyebrow">CherryPashkaParty для Windows</p>
          <h1 id="download-title">Скачать приложение</h1>
          <p className="download-description">
            Установите CherryPashkaParty, чтобы создавать вечеринки и управлять музыкой.
          </p>
          {loading && (
            <p className="download-status" role="status" aria-live="polite">
              Ищем актуальную бета-версию…
            </p>
          )}
          {!loading && error && (
            <p className="download-error" role="alert">
              {error}
            </p>
          )}
          {!loading && release && (
            <div className="download-release">
              <p className="download-version">Версия {release.version}</p>
              <ButtonLink
                className="download-button"
                href={release.downloadUrl}
                variant="primary"
              >
                Скачать для Windows
              </ButtonLink>
              <p className="download-file-details">ZIP-архив · Windows x64</p>
            </div>
          )}
          <Link className="download-guide-link" to={ROUTES.FIRST_RUN_GUIDE}>
            <span className="download-guide-title">Впервые запускаете CherryPashkaParty?</span>
            <span className="download-guide-description">
              Откройте краткую инструкцию по установке и первому эфиру
            </span>
          </Link>
        </section>
      </main>
    </div>
  );
};
