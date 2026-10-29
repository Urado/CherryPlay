import { getPlatform, isPlatformInitialized } from '../platform';

let cachedServerUrl: string | null = null;
let cachedWebBaseUrl: string | null = null;
let warnedEmptyElectronServerUrl = false;

const isConfiguredServerUrl = (value: string | null | undefined): value is string => {
  return value !== undefined && value !== null;
};

const warnEmptyElectronServerUrlOnce = (): void => {
  if (warnedEmptyElectronServerUrl) {
    return;
  }
  warnedEmptyElectronServerUrl = true;
  console.warn(
    '[serverConfig] Empty serverUrl from Electron config is only intended for web demo same-origin proxy. ' +
      'Electron should set serverUrl in serverConfig.development.json or serverConfig.production.json.',
  );
};

const cacheElectronServerUrl = (data: string): string => {
  if (data === '') {
    warnEmptyElectronServerUrlOnce();
  }
  cachedServerUrl = data;
  return data;
};

const getEnvServerUrl = (): string | undefined => {
  const value: unknown = import.meta.env.VITE_API_URL;
  return isConfiguredServerUrl(value) ? value : undefined;
};

const invokeConfig = async <T>(channel: string, payload?: object): Promise<T | null> => {
  if (!isPlatformInitialized()) {
    return null;
  }

  const rawResult: unknown = await getPlatform().invoke(channel, payload);
  if (!rawResult || typeof rawResult !== 'object') {
    return null;
  }

  const result = rawResult as { success: unknown; data?: unknown; error?: unknown };

  if (result.success === true && result.data !== undefined) {
    return result.data as T;
  }

  if (result.success === false && typeof result.error === 'string') {
    throw new Error(result.error);
  }

  return null;
};

export const getWebBaseUrl = async (): Promise<string> => {
  if (cachedWebBaseUrl !== null) {
    return cachedWebBaseUrl;
  }

  if (isPlatformInitialized()) {
    try {
      const data = await invokeConfig<string>('config:getWebBaseUrl');
      if (isConfiguredServerUrl(data)) {
        cachedWebBaseUrl = data;
        return data;
      }
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to get web base URL from config file.');
    }
  }

  throw new Error(
    'Web base URL is not configured. Set webBaseUrl in serverConfig.development.json / serverConfig.production.json.',
  );
};

export const getWebBaseUrlSync = (): string => {
  if (cachedWebBaseUrl !== null) {
    return cachedWebBaseUrl;
  }

  throw new Error(
    'Web base URL is not configured. Load webBaseUrl from server config and restart the application.',
  );
};

export const getServerUrl = async (): Promise<string> => {
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
};

export const getServerUrlSync = (): string => {
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
};

export const setServerUrl = async (serverUrl: string): Promise<boolean> => {
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
};

export const clearServerUrlCache = (): void => {
  cachedServerUrl = null;
  cachedWebBaseUrl = null;
};

export const getConfigFilePath = async (): Promise<string | null> => {
  if (!isPlatformInitialized()) {
    return null;
  }

  try {
    return await invokeConfig<string>('config:getConfigPath');
  } catch {
    return null;
  }
};

export const initializeServerConfig = async (): Promise<void> => {
  if (!isPlatformInitialized()) {
    return;
  }

  try {
    const serverUrlData = await invokeConfig<string>('config:getServerUrl');
    if (isConfiguredServerUrl(serverUrlData)) {
      cacheElectronServerUrl(serverUrlData);
      const { clearApiConfigCache } = await import('./apiConfig');
      clearApiConfigCache();
    } else {
      cachedServerUrl = null;
    }

    const webBaseUrlData = await invokeConfig<string>('config:getWebBaseUrl');
    if (isConfiguredServerUrl(webBaseUrlData)) {
      cachedWebBaseUrl = webBaseUrlData;
    } else {
      cachedWebBaseUrl = null;
    }
  } catch {
    cachedServerUrl = null;
    cachedWebBaseUrl = null;
  }
};
