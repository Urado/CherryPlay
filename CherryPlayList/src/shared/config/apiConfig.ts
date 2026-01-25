import { getServerUrl, getServerUrlSync } from './serverConfig';

let cachedApiConfig: {
  serverUrl: string;
  signalRUrl: string;
  apiUrl: string;
} | null = null;

async function getApiConfigAsync(): Promise<{
  serverUrl: string;
  signalRUrl: string;
  apiUrl: string;
}> {
  const serverUrl = await getServerUrl();
  return {
    serverUrl,
    signalRUrl: `${serverUrl}/partyHub`,
    apiUrl: `${serverUrl}/api`,
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

  const serverUrl = getServerUrlSync();
  cachedApiConfig = {
    serverUrl,
    signalRUrl: `${serverUrl}/partyHub`,
    apiUrl: `${serverUrl}/api`,
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
