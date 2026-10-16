import type { ConsentInput, ConsentDecision } from './legalDocuments';

export const OAUTH_PENDING_CONSENTS_STORAGE_KEY = 'cherryplay.oauth.pendingConsents';

const CONSENT_DECISIONS: readonly ConsentDecision[] = ['grant', 'withdraw', 'deny'];

const isConsentDecision = (value: unknown): value is ConsentDecision => {
  return typeof value === 'string' && (CONSENT_DECISIONS as readonly string[]).includes(value);
};

const isConsentInput = (value: unknown): value is ConsentInput => {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === 'string' &&
    typeof record.legalDocumentVersionId === 'string' &&
    typeof record.documentHash === 'string' &&
    isConsentDecision(record.decision)
  );
};

export const stashOAuthPendingConsents = (consents: ConsentInput[]): void => {
  if (typeof sessionStorage === 'undefined') {
    return;
  }
  sessionStorage.setItem(OAUTH_PENDING_CONSENTS_STORAGE_KEY, JSON.stringify(consents));
};

export const readOAuthPendingConsents = (): ConsentInput[] | null => {
  if (typeof sessionStorage === 'undefined') {
    return null;
  }
  const raw = sessionStorage.getItem(OAUTH_PENDING_CONSENTS_STORAGE_KEY);
  if (!raw) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0 || !parsed.every(isConsentInput)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

export const clearOAuthPendingConsents = (): void => {
  if (typeof sessionStorage === 'undefined') {
    return;
  }
  sessionStorage.removeItem(OAUTH_PENDING_CONSENTS_STORAGE_KEY);
};
