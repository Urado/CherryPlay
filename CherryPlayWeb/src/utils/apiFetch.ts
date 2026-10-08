import { getClientVersionHeaders } from '../config/clientVersion';

import { parseApiErrorPayload } from './apiErrorHandler';
import { notifyClientOutdated } from './clientOutdatedNotifier';
import { notifyConsentRequired } from './consentGateNotifier';

export const CLIENT_OUTDATED_STATUS = 426;
export const CLIENT_OUTDATED_CODE = 'client_outdated';
export const CONSENT_REQUIRED_STATUS = 403;
export const CONSENT_REQUIRED_CODE = 'consent_required';

interface ClientOutdatedPayload {
  code?: string;
  requiredVersion?: string;
}

interface ConsentRequiredPayload {
  code?: string;
  message?: string;
  missing?: string[];
}

function mergeClientVersionHeaders(init?: RequestInit): Headers {
  const headers = new Headers(init?.headers);

  for (const [key, value] of Object.entries(getClientVersionHeaders())) {
    if (!headers.has(key)) {
      headers.set(key, value);
    }
  }

  return headers;
}

async function handleClientOutdatedResponse(response: Response): Promise<void> {
  if (response.status !== CLIENT_OUTDATED_STATUS) {
    return;
  }

  const payload = await parseApiErrorPayload<ClientOutdatedPayload>(response.clone());
  if (payload?.code === CLIENT_OUTDATED_CODE) {
    notifyClientOutdated();
  }
}

async function handleConsentRequiredResponse(response: Response): Promise<void> {
  if (response.status !== CONSENT_REQUIRED_STATUS) {
    return;
  }

  const payload = await parseApiErrorPayload<ConsentRequiredPayload>(response.clone());
  if (payload?.code !== CONSENT_REQUIRED_CODE) {
    return;
  }

  const missing = Array.isArray(payload.missing)
    ? payload.missing.filter((id): id is string => typeof id === 'string')
    : undefined;
  notifyConsentRequired(missing);
}

/**
 * Обёртка над fetch: добавляет заголовки версии клиента и обрабатывает
 * 426 client_outdated / 403 consent_required.
 */
export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const response = await fetch(input, {
    ...init,
    headers: mergeClientVersionHeaders(init),
  });

  await handleClientOutdatedResponse(response);
  await handleConsentRequiredResponse(response);

  return response;
}
