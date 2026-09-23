import { markdownBodyToParagraphs, parseLegalMarkdown, type LegalBlock } from './parseLegalMarkdown';
import consentMd from './v1.0/consent.md?raw';
import cookiesMd from './v1.0/cookies.md?raw';
import packManifest from './v1.0/manifest.json';
import operatorMd from './v1.0/operator.md?raw';
import privacyMd from './v1.0/privacy.md?raw';
import termsMd from './v1.0/terms.md?raw';

export const LEGAL_CONTENT_VERSION = packManifest.documentVersion;

export type LegalDocKey = 'privacy' | 'consent' | 'terms' | 'cookies';

export interface LegalDocumentContent {
  key: LegalDocKey;
  title: string;
  documentVersion: string;
  effectiveFrom: string;
  blocks: LegalBlock[];
}

const RAW_BY_FILE: Record<string, string> = {
  'consent.md': consentMd,
  'terms.md': termsMd,
  'privacy.md': privacyMd,
  'cookies.md': cookiesMd,
};

const KEY_BY_TYPE: Record<string, LegalDocKey> = {
  pd_consent_text: 'consent',
  terms: 'terms',
  privacy_policy: 'privacy',
  cookie_policy: 'cookies',
};

function loadDocuments(): Record<LegalDocKey, LegalDocumentContent> {
  const result = {} as Record<LegalDocKey, LegalDocumentContent>;
  for (const entry of packManifest.documents) {
    const key = KEY_BY_TYPE[entry.type];
    if (!key) {
      throw new Error(`Unknown legal document type in manifest: ${entry.type}`);
    }
    const raw = RAW_BY_FILE[entry.file];
    if (raw === undefined) {
      throw new Error(`No raw import wired for ${entry.file}`);
    }
    if (raw.trimStart().startsWith('---')) {
      throw new Error(`${entry.file}: legal markdown must not contain YAML frontmatter`);
    }
    result[key] = {
      key,
      title: entry.title,
      documentVersion: packManifest.documentVersion,
      effectiveFrom: packManifest.effectiveFrom,
      blocks: parseLegalMarkdown(raw),
    };
  }
  return result;
}

export const LEGAL_DOCUMENTS_CONTENT: Record<LegalDocKey, LegalDocumentContent> = loadDocuments();

export interface LegalOperatorContent {
  title: string;
  operatorName: string;
  generalContact: string;
  privacyContact: string;
  subjectRequestChannel: string;
  paragraphs: string[];
}

function loadOperator(): LegalOperatorContent {
  const { operator } = packManifest;
  if (operatorMd.trimStart().startsWith('---')) {
    throw new Error('operator.md: legal markdown must not contain YAML frontmatter');
  }
  return {
    title: operator.title,
    operatorName: operator.operatorName,
    generalContact: operator.generalContact,
    privacyContact: operator.privacyContact,
    subjectRequestChannel: operator.subjectRequestChannel,
    paragraphs: markdownBodyToParagraphs(operatorMd),
  };
}

export const LEGAL_OPERATOR_CONTENT: LegalOperatorContent = loadOperator();

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
