import { getPlatform, isPlatformInitialized } from '../platform';

let cachedServerUrl: string | null = null;
let warnedEmptyElectronServerUrl = false;

function isConfiguredServerUrl(value: string | null | undefined): value is string {
  return value !== undefined && value !== null;
}

function warnEmptyElectronServerUrlOnce(): void {
  if (warnedEmptyElectronServerUrl) {
    return;
  }
  warnedEmptyElectronServerUrl = true;
  console.warn(
    '[serverConfig] Empty serverUrl from Electron config is only intended for web demo same-origin proxy. ' +
      'Electron should set serverUrl in serverConfig.development.json or serverConfig.production.json.',
  );
}

function cacheElectronServerUrl(data: string): string {
  if (data === '') {
    warnEmptyElectronServerUrlOnce();
  }
  cachedServerUrl = data;
  return data;
}

function getEnvServerUrl(): string | undefined {
  const value = import.meta.env.VITE_API_URL;
  return isConfiguredServerUrl(value) ? value : undefined;
}

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
  const envServerUrl = getEnvServerUrl();
  if (envServerUrl !== undefined) {
    return envServerUrl;
  }

  if (isPlatformInitialized()) {
    try {
      const data = await invokeConfig<string>('config:getServerUrl');
      if (isConfiguredServerUrl(data)) {
        return cacheElectronServerUrl(data);
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
  const envServerUrl = getEnvServerUrl();
  if (envServerUrl !== undefined) {
    return envServerUrl;
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
    if (isConfiguredServerUrl(data)) {
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
    if (isConfiguredServerUrl(data)) {
      cacheElectronServerUrl(data);
      const { clearApiConfigCache } = await import('./apiConfig');
      clearApiConfigCache();
    } else {
      cachedServerUrl = null;
    }
  } catch {
    cachedServerUrl = null;
  }
}
