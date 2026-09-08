import { Link, Navigate, useParams } from 'react-router-dom';

import { SiteFooter } from '../components/SiteFooter';
import {
  resolveLegalDocument,
  type LegalDocKey,
} from '../content/legal/documents';
import { ROUTES } from '../constants/routes';
import './LegalPage.css';

const VALID_KEYS: LegalDocKey[] = ['privacy', 'consent', 'terms', 'cookies'];

function isLegalDocKey(value: string | undefined): value is LegalDocKey {
  return !!value && (VALID_KEYS as string[]).includes(value);
}

export function LegalDocumentPage({ docKey }: { docKey?: LegalDocKey }) {
  const params = useParams<{ docKey?: string; version?: string }>();
  const key = docKey ?? (isLegalDocKey(params.docKey) ? params.docKey : undefined);
  const version = params.version;

  if (!key) {
    return <Navigate to={ROUTES.HOME} replace />;
  }

  const doc = resolveLegalDocument(key, version);
  if (!doc) {
    return <Navigate to={ROUTES.HOME} replace />;
  }

  const archivePath =
    key === 'privacy'
      ? ROUTES.PRIVACY_ARCHIVE(doc.documentVersion)
      : key === 'consent'
        ? ROUTES.CONSENT_ARCHIVE(doc.documentVersion)
        : key === 'terms'
          ? ROUTES.TERMS_ARCHIVE(doc.documentVersion)
          : ROUTES.COOKIES_ARCHIVE(doc.documentVersion);

  const currentPath =
    key === 'privacy'
      ? ROUTES.PRIVACY
      : key === 'consent'
        ? ROUTES.CONSENT
        : key === 'terms'
          ? ROUTES.TERMS
          : ROUTES.COOKIES;

  return (
    <div className="legal-page">
      <main className="legal-page-main">
        <p className="legal-page-back">
          <Link to={ROUTES.HOME}>← На главную</Link>
        </p>
        <h1>{doc.title}</h1>
        <p className="legal-page-meta">
          Версия {doc.documentVersion} · действует с {doc.effectiveFrom}
          {version ? (
            <>
              {' '}
              · архив · <Link to={currentPath}>актуальная редакция</Link>
            </>
          ) : (
            <>
              {' '}
              · <Link to={archivePath}>архив этой версии</Link>
            </>
          )}
        </p>
        <div className="legal-page-body">
          {doc.paragraphs.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
