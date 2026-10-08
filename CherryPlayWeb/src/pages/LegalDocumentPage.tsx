import { Link, Navigate, useParams } from 'react-router-dom';

import { ROUTES } from '../constants/routes';
import { resolveLegalDocument, type LegalDocKey } from '../content/legal/documents';
import type { LegalBlock } from '../content/legal/parseLegalMarkdown';

import { linkifyLegalText } from './linkifyLegalText';
import './LegalPage.css';

const VALID_KEYS: LegalDocKey[] = ['privacy', 'consent', 'terms', 'cookies'];

function isLegalDocKey(value: string | undefined): value is LegalDocKey {
  return !!value && (VALID_KEYS as string[]).includes(value);
}

function renderBlock(block: LegalBlock, index: number) {
  switch (block.type) {
    case 'heading': {
      const Tag = block.level === 2 ? 'h2' : 'h3';
      return <Tag key={index}>{linkifyLegalText(block.text)}</Tag>;
    }
    case 'list': {
      const ListTag = block.ordered ? 'ol' : 'ul';
      return (
        <ListTag key={index}>
          {block.items.map((item, itemIndex) => (
            <li key={itemIndex}>{linkifyLegalText(item)}</li>
          ))}
        </ListTag>
      );
    }
    case 'paragraph':
    default:
      return <p key={index}>{linkifyLegalText(block.text)}</p>;
  }
}

export const LegalDocumentPage = ({ docKey }: { docKey?: LegalDocKey }) => {
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
        <div className="legal-page-body">{doc.blocks.map(renderBlock)}</div>
      </main>
    </div>
  );
};
