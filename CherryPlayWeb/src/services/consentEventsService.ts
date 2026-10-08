import {
  REQUIRED_CONSENT_DOCUMENTS,
  type ConsentDecision,
  type ConsentInput,
} from '@cherryplay/components';

import { API_ENDPOINTS, getApiUrl } from '../config/apiConfig';
import { handleApiResponse } from '../utils/apiErrorHandler';
import { apiFetch } from '../utils/apiFetch';

export interface ConsentEventDto {
  id: string;
  legalDocumentVersionId: string;
  documentHash: string;
  decision: ConsentDecision;
  eventAt: string;
}

export interface CreateConsentEventsRequest {
  events: ConsentInput[];
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

export function computeMissingRequiredVersionIds(events: ConsentEventDto[]): string[] {
  const missing: string[] = [];

  for (const doc of REQUIRED_CONSENT_DOCUMENTS) {
    const latest = events
      .filter((event) => event.legalDocumentVersionId === doc.versionId)
      .sort((a, b) => new Date(b.eventAt).getTime() - new Date(a.eventAt).getTime())[0];

    if (!latest || latest.decision !== 'grant') {
      missing.push(doc.versionId);
    }
  }

  return missing;
}

export class ConsentDocumentsOutdatedError extends Error {
  constructor(message = 'Версии согласий на сервере не совпадают с клиентом. Обновите страницу.') {
    super(message);
    this.name = 'ConsentDocumentsOutdatedError';
  }
}

export function buildConsentInputsForMissing(
  missing?: string[],
  createId: () => string = createConsentId,
): ConsentInput[] {
  const docs =
    missing === undefined
      ? REQUIRED_CONSENT_DOCUMENTS
      : REQUIRED_CONSENT_DOCUMENTS.filter((doc) => missing.includes(doc.versionId));

  if (missing !== undefined && docs.length === 0) {
    throw new ConsentDocumentsOutdatedError();
  }

  return docs.map((doc) => ({
    id: createId(),
    legalDocumentVersionId: doc.versionId,
    documentHash: doc.contentHash,
    decision: 'grant' as const,
  }));
}

export async function listConsentEvents(): Promise<ConsentEventDto[]> {
  const response = await apiFetch(getApiUrl(API_ENDPOINTS.CONSENT_EVENTS), {
    method: 'GET',
    credentials: 'include',
    cache: 'no-cache',
  });

  return handleApiResponse<ConsentEventDto[]>(response, 'Не удалось загрузить согласия');
}

export async function createConsentEvents(consents: ConsentInput[]): Promise<ConsentEventDto[]> {
  const body: CreateConsentEventsRequest = { events: consents };
  const response = await apiFetch(getApiUrl(API_ENDPOINTS.CONSENT_EVENTS), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
    cache: 'no-cache',
  });

  return handleApiResponse<ConsentEventDto[]>(response, 'Не удалось сохранить согласия');
}
