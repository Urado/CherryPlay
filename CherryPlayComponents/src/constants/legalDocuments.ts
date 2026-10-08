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
      'Берём email, имя и данные входа совершеннолетнего организатора, чтобы открыть аккаунт.\nВедём кабинет и вечеринки, шлём только служебные письма.\nЗрители не регистрируются; прикладные логи их IP и User-Agent не ведём.\nСогласие можно отозвать в кабинете или письмом на samurai-94@mail.ru.',
  },
  terms: {
    checkboxLabel: 'Пользовательское соглашение',
    summary:
      'Аккаунт предназначен для дееспособного организатора старше 18 лет.\nЗа тексты и картинки в описании отвечаете вы.\nВ описание нельзя писать номер карты, CVV и чужие персональные данные.\nСервис сейчас бесплатный; важные изменения сообщаем минимум за 10 дней.',
  },
  privacy_policy: {
    checkboxLabel: 'Политика обработки персональных данных',
    summary:
      'Аккаунты и персональные данные в CherryPlay относятся к организаторам.\nЗрители остаются анонимными; прикладные логи их запросов не сохраняем.\nХостинг и база — Cloud.ru в России, служебные письма — RuSender.\nЗапрос на доступ, исправление или удаление — на samurai-94@mail.ru.',
  },
  cookie_policy: {
    checkboxLabel: 'Политика cookie',
    summary:
      'Сессия входа в кабинет хранится в cookie до 30 дней; без неё вход не работает.\nЗначение недоступно скриптам страницы; в production передаётся только по защищённому соединению.\nРекламных и аналитических cookie нет.\nЗакрытие уведомления запоминается только в этом браузере.',
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
