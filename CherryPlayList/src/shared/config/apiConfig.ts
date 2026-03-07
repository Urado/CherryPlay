import { getServerUrl, getServerUrlSync } from './serverConfig';

let cachedApiConfig: {
  serverUrl: string;
  signalRUrl: string;
  apiUrl: string;
} | null = null;

/** Убирает завершающий слэш у base URL, чтобы не получать двойной слэш в путях */
function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

function buildSignalRUrl(serverUrl: string): string {
  return `${normalizeBaseUrl(serverUrl)}/partyHub`;
}

function buildApiUrl(serverUrl: string): string {
  return `${normalizeBaseUrl(serverUrl)}/api`;
}

async function getApiConfigAsync(): Promise<{
  serverUrl: string;
  signalRUrl: string;
  apiUrl: string;
}> {
  const raw = await getServerUrl();
  const serverUrl = normalizeBaseUrl(raw);
  return {
    serverUrl,
    signalRUrl: buildSignalRUrl(raw),
    apiUrl: buildApiUrl(raw),
  };
}

function getApiConfigSync(): {
  serverUrl: string;
  signalRUrl: string;
  apiUrl: string;
} {
  if (cachedApiConfig) {
    return cachedApiConfig;
  }

  const raw = getServerUrlSync();
  const serverUrl = normalizeBaseUrl(raw);
  cachedApiConfig = {
    serverUrl,
    signalRUrl: buildSignalRUrl(raw),
    apiUrl: buildApiUrl(raw),
  };

  return cachedApiConfig;
}

export const apiConfig = {
  get serverUrl(): string {
    try {
      return getApiConfigSync().serverUrl;
    } catch (error) {
      throw new Error(
        `Failed to get server URL: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  },

  get signalRUrl(): string {
    try {
      return getApiConfigSync().signalRUrl;
    } catch (error) {
      throw new Error(
        `Failed to get SignalR URL: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  },

  get apiUrl(): string {
    try {
      return getApiConfigSync().apiUrl;
    } catch (error) {
      throw new Error(
        `Failed to get API URL: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  },
};

export async function getApiConfig(): Promise<{
  serverUrl: string;
  signalRUrl: string;
  apiUrl: string;
}> {
  const config = await getApiConfigAsync();
  cachedApiConfig = config;
  return config;
}

export function clearApiConfigCache(): void {
  cachedApiConfig = null;
}
