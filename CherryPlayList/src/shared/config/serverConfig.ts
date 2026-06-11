import { getPlatform, isPlatformInitialized } from '../platform';

let cachedServerUrl: string | null = null;

async function invokeConfig<T>(channel: string, payload?: object): Promise<T | null> {
  if (!isPlatformInitialized()) {
    return null;
  }

  const result = (await getPlatform().invoke(channel, payload)) as
    | { success: true; data: T }
    | { success: false; error: string };

  if (result.success && result.data !== undefined) {
    return result.data;
  }

  if (result.success === false) {
    throw new Error(result.error);
  }

  return null;
}

export async function getServerUrl(): Promise<string> {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  if (isPlatformInitialized()) {
    try {
      const data = await invokeConfig<string>('config:getServerUrl');
      if (data) {
        cachedServerUrl = data;
        return data;
      }

      cachedServerUrl = null;
      throw new Error(
        'Server URL is not configured. Set serverUrl in serverConfig.development.json (dev) or serverConfig.production.json (release).',
      );
    } catch (error) {
      cachedServerUrl = null;
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(
        'Failed to get server URL from config file. Configure serverUrl in serverConfig.development.json or serverConfig.production.json.',
      );
    }
  }

  throw new Error(
    'Server URL is not configured. Set VITE_API_URL or serverUrl in serverConfig.development.json / serverConfig.production.json.',
  );
}

export function getServerUrlSync(): string {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  if (cachedServerUrl !== null) {
    return cachedServerUrl;
  }

  throw new Error(
    'Server URL is not configured. Set VITE_API_URL or serverUrl in server config and restart the application.',
  );
}

export async function setServerUrl(serverUrl: string): Promise<boolean> {
  if (!isPlatformInitialized()) {
    return false;
  }

  try {
    const data = await invokeConfig<string>('config:setServerUrl', { serverUrl });
    if (data) {
      cachedServerUrl = serverUrl;
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function clearServerUrlCache(): void {
  cachedServerUrl = null;
}

export async function getConfigFilePath(): Promise<string | null> {
  if (!isPlatformInitialized()) {
    return null;
  }

  try {
    return await invokeConfig<string>('config:getConfigPath');
  } catch {
    return null;
  }
}

export async function initializeServerConfig(): Promise<void> {
  if (!isPlatformInitialized()) {
    return;
  }

  try {
    const data = await invokeConfig<string>('config:getServerUrl');
    if (data) {
      cachedServerUrl = data;
      const { clearApiConfigCache } = await import('./apiConfig');
      clearApiConfigCache();
    } else {
      cachedServerUrl = null;
    }
  } catch {
    cachedServerUrl = null;
  }
}
