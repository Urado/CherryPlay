import { getClientVersionHeaders } from '../config/clientVersion';

import { parseApiErrorPayload } from './apiErrorHandler';
import { notifyClientOutdated } from './clientOutdatedNotifier';

export const CLIENT_OUTDATED_STATUS = 426;
export const CLIENT_OUTDATED_CODE = 'client_outdated';

interface ClientOutdatedPayload {
  code?: string;
  requiredVersion?: string;
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
