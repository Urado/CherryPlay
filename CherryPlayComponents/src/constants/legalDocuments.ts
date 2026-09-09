import legalRegistry from './legal-registry.generated.json';

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

interface LegalRegistryDocument {
  type: string;
  versionId: string;
  documentVersion: string;
  contentHash: string;
  effectiveFrom: string;
  currentPath: string;
  archivePath: string;
  title: string;
  sourceFile: string;
}

interface LegalRegistryUiFields {
  checkboxLabel: string;
  summary: string;
}

const REQUIRED_REGISTRY_TYPES: readonly LegalDocumentType[] = [
  'pd_consent_text',
  'terms',
  'privacy_policy',
  'cookie_policy',
];

const UI_FIELDS_BY_TYPE: Record<LegalDocumentType, LegalRegistryUiFields> = {
  pd_consent_text: {
    checkboxLabel: 'Согласие на обработку персональных данных',
    summary:
      'Мы обрабатываем email, имя и данные аккаунта организатора для регистрации и работы сервиса. Данные зрителей вечеринок не собираем.',
  },
  terms: {
    checkboxLabel: 'Пользовательское соглашение',
    summary:
      'Правила использования CherryPlay: аккаунт организатора, ответственность за контент вечеринок и ограничения сервиса.',
  },
  privacy_policy: {
    checkboxLabel: 'Политика обработки персональных данных',
    summary: 'Как мы обрабатываем персональные данные организаторов (мок-текст).',
  },
  cookie_policy: {
    checkboxLabel: 'Политика cookie',
    summary: 'Необходимые cookie для входа и сессии организатора (мок-текст).',
  },
};

function isLegalDocumentType(type: string): type is LegalDocumentType {
  return (REQUIRED_REGISTRY_TYPES as readonly string[]).includes(type);
}

function buildDeployConfigFromRegistry(type: LegalDocumentType): LegalDocumentDeployConfig {
  const documents = legalRegistry.documents as LegalRegistryDocument[];
  const entry = documents.find((doc) => doc.type === type);
  if (!entry) {
    throw new Error(
      `legal-registry.generated.json is missing required document type "${type}". Re-run CherryPlay.LegalPublish.`,
    );
  }
  if (!isLegalDocumentType(entry.type)) {
    throw new Error(`Unexpected legal document type in registry: "${entry.type}".`);
  }

  const ui = UI_FIELDS_BY_TYPE[type];
  return {
    type,
    versionId: entry.versionId,
    documentVersion: entry.documentVersion,
    contentHash: entry.contentHash,
    currentPath: entry.currentPath,
    archivePath: entry.archivePath,
    title: entry.title,
    checkboxLabel: ui.checkboxLabel,
    summary: ui.summary,
    effectiveFrom: entry.effectiveFrom,
  };
}

for (const type of REQUIRED_REGISTRY_TYPES) {
  const documents = legalRegistry.documents as LegalRegistryDocument[];
  if (!documents.some((doc) => doc.type === type)) {
    throw new Error(
      `legal-registry.generated.json is missing required document type "${type}". Re-run CherryPlay.LegalPublish.`,
    );
  }
}

export const LEGAL_PD_CONSENT: LegalDocumentDeployConfig =
  buildDeployConfigFromRegistry('pd_consent_text');

export const LEGAL_TERMS: LegalDocumentDeployConfig = buildDeployConfigFromRegistry('terms');

export const LEGAL_PRIVACY: LegalDocumentDeployConfig =
  buildDeployConfigFromRegistry('privacy_policy');

export const LEGAL_COOKIES: LegalDocumentDeployConfig =
  buildDeployConfigFromRegistry('cookie_policy');

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
