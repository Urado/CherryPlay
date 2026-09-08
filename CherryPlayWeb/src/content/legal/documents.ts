import { markdownBodyToParagraphs, parseLegalMarkdown } from './parseLegalMarkdown';
import cookiesMd from './v1.0/cookies.md?raw';
import consentMd from './v1.0/consent.md?raw';
import operatorMd from './v1.0/operator.md?raw';
import privacyMd from './v1.0/privacy.md?raw';
import termsMd from './v1.0/terms.md?raw';

/** Current published legal pack (folder name = version). */
export const LEGAL_CONTENT_VERSION = '1.0';

export type LegalDocKey = 'privacy' | 'consent' | 'terms' | 'cookies';

export interface LegalDocumentContent {
  key: LegalDocKey;
  title: string;
  documentVersion: string;
  effectiveFrom: string;
  /** Body paragraphs from markdown (mocks until CP-036). */
  paragraphs: string[];
}

function loadDocument(key: LegalDocKey, raw: string): LegalDocumentContent {
  const { meta, body } = parseLegalMarkdown(raw);
  return {
    key,
    title: meta.title ?? key,
    documentVersion: meta.documentVersion ?? LEGAL_CONTENT_VERSION,
    effectiveFrom: meta.effectiveFrom ?? '',
    paragraphs: markdownBodyToParagraphs(body),
  };
}

export const LEGAL_DOCUMENTS_CONTENT: Record<LegalDocKey, LegalDocumentContent> = {
  privacy: loadDocument('privacy', privacyMd),
  consent: loadDocument('consent', consentMd),
  terms: loadDocument('terms', termsMd),
  cookies: loadDocument('cookies', cookiesMd),
};

export interface LegalOperatorContent {
  title: string;
  operatorName: string;
  generalContact: string;
  privacyContact: string;
  subjectRequestChannel: string;
  paragraphs: string[];
}

function loadOperator(raw: string): LegalOperatorContent {
  const { meta, body } = parseLegalMarkdown(raw);
  return {
    title: meta.title ?? 'Реквизиты и контакты',
    operatorName: meta.operatorName ?? '',
    generalContact: meta.generalContact ?? '',
    privacyContact: meta.privacyContact ?? '',
    subjectRequestChannel: meta.subjectRequestChannel ?? '',
    paragraphs: markdownBodyToParagraphs(body),
  };
}

export const LEGAL_OPERATOR_CONTENT: LegalOperatorContent = loadOperator(operatorMd);

export function resolveLegalDocument(
  key: LegalDocKey,
  version?: string,
): LegalDocumentContent | null {
  const doc = LEGAL_DOCUMENTS_CONTENT[key];
  if (!doc) {
    return null;
  }
  if (version && version !== doc.documentVersion) {
    return null;
  }
  return doc;
}
