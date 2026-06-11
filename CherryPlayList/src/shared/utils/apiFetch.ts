import { getClientVersionHeaders } from '../config/clientVersion';
import { notifyClientOutdated } from '../stores/clientOutdatedStore';

import { parseApiErrorPayload } from './apiErrorHandler';

export const CLIENT_OUTDATED_STATUS = 426;
export const CLIENT_OUTDATED_CODE = 'client_outdated';

interface ClientOutdatedPayload {
  code?: string;
  requiredVersion?: string;
}

function hasHeaderKey(headers: Record<string, string>, name: string): boolean {
  const lower = name.toLowerCase();
  return Object.keys(headers).some((key) => key.toLowerCase() === lower);
}

function mergeClientVersionHeaders(init?: RequestInit): Record<string, string> {
  const merged: Record<string, string> = {};

  const source = init?.headers;
  if (source instanceof Headers) {
    source.forEach((value, key) => {
      merged[key] = value;
    });
  } else if (Array.isArray(source)) {
    for (const [key, value] of source) {
      merged[key] = value;
    }
  } else if (source) {
    Object.assign(merged, source);
  }

  for (const [key, value] of Object.entries(getClientVersionHeaders())) {
    if (!hasHeaderKey(merged, key)) {
      merged[key] = value;
    }
  }

  return merged;
}

async function handleClientOutdatedResponse(response: Response): Promise<void> {
  if (response.status !== CLIENT_OUTDATED_STATUS) {
    return;
  }

  const payload = await parseApiErrorPayload<ClientOutdatedPayload>(response.clone());
  if (payload?.code === CLIENT_OUTDATED_CODE) {
    notifyClientOutdated(payload.requiredVersion);
  }
}

/**
 * Обёртка над fetch: добавляет заголовки версии клиента и обрабатывает 426 client_outdated.
 */
export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const response = await fetch(input, {
    ...init,
    headers: mergeClientVersionHeaders(init),
  });

  await handleClientOutdatedResponse(response);

  return response;
}
