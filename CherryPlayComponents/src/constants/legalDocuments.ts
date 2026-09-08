export type LegalDocumentType = 'pd_consent_text' | 'terms' | 'privacy_policy' | 'cookie_policy';

export type ConsentDecision = 'grant' | 'withdraw' | 'deny';

export interface ConsentInput {
  id: string;
  legalDocumentVersionId: string;
  documentHash: string;
  decision: ConsentDecision;
}

export interface LegalDocumentDeployConfig {
  type: LegalDocumentType;
  versionId: string;
  documentVersion: string;
  contentHash: string;
  currentPath: string;
  archivePath: string;
  title: string;
  checkboxLabel: string;
  summary: string;
  effectiveFrom: string;
}

/** Deploy-time registry (InMemory seed ids/hashes). No GET catalog. */
export const LEGAL_PD_CONSENT: LegalDocumentDeployConfig = {
  type: 'pd_consent_text',
  versionId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  documentVersion: '1.0',
  contentHash: 'pd-consent-hash-v1',
  currentPath: '/consent',
  archivePath: '/consent/v/1.0',
  title: 'Согласие на обработку персональных данных',
  checkboxLabel: 'Согласие на обработку персональных данных',
  summary:
    'Мы обрабатываем email, имя и данные аккаунта организатора для регистрации и работы сервиса. Данные зрителей вечеринок не собираем.',
  effectiveFrom: '2026-09-01',
};

export const LEGAL_TERMS: LegalDocumentDeployConfig = {
  type: 'terms',
  versionId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  documentVersion: '1.0',
  contentHash: 'terms-hash-v1',
  currentPath: '/terms',
  archivePath: '/terms/v/1.0',
  title: 'Пользовательское соглашение',
  checkboxLabel: 'Пользовательское соглашение',
  summary:
    'Правила использования CherryPlay: аккаунт организатора, ответственность за контент вечеринок и ограничения сервиса.',
  effectiveFrom: '2026-09-01',
};

export const LEGAL_PRIVACY: LegalDocumentDeployConfig = {
  type: 'privacy_policy',
  versionId: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
  documentVersion: '1.0',
  contentHash: 'privacy-hash-v1',
  currentPath: '/privacy',
  archivePath: '/privacy/v/1.0',
  title: 'Политика обработки персональных данных',
  checkboxLabel: 'Политика обработки персональных данных',
  summary: 'Как мы обрабатываем персональные данные организаторов (мок-текст).',
  effectiveFrom: '2026-09-01',
};

export const LEGAL_COOKIES: LegalDocumentDeployConfig = {
  type: 'cookie_policy',
  versionId: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
  documentVersion: '1.0',
  contentHash: 'cookies-hash-v1',
  currentPath: '/cookies',
  archivePath: '/cookies/v/1.0',
  title: 'Политика использования cookie',
  checkboxLabel: 'Политика cookie',
  summary: 'Необходимые cookie для входа и сессии организатора (мок-текст).',
  effectiveFrom: '2026-09-01',
};

/** Documents that must be granted at email/OAuth registration. */
export const REQUIRED_CONSENT_DOCUMENTS: readonly LegalDocumentDeployConfig[] = [
  LEGAL_PD_CONSENT,
  LEGAL_TERMS,
];

export function areRequiredConsentsAccepted(pdConsent: boolean, terms: boolean): boolean {
  return pdConsent && terms;
}

function createConsentId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Build grant payloads for required docs (client UUID = idempotency). */
export function buildRequiredConsentInputs(
  createId: () => string = createConsentId,
): ConsentInput[] {
  return REQUIRED_CONSENT_DOCUMENTS.map((doc) => ({
    id: createId(),
    legalDocumentVersionId: doc.versionId,
    documentHash: doc.contentHash,
    decision: 'grant' as const,
  }));
}
