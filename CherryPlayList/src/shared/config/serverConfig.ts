let cachedServerUrl: string | null = null;

export async function getServerUrl(): Promise<string> {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  if (typeof window !== 'undefined' && window.api) {
    try {
      const result = (await window.api.invoke('config:getServerUrl')) as
        | { success: true; data: string }
        | { success: false; error: string };

      if (result.success && result.data) {
        cachedServerUrl = result.data;
        return result.data;
      }

      cachedServerUrl = null;
      throw new Error(
        result.success === false
          ? result.error
          : 'Server URL is not configured. Set serverUrl in serverConfig.development.json (dev) or serverConfig.production.json (release).',
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
  if (typeof window === 'undefined' || !window.api) {
    return false;
  }

  try {
    const result = (await window.api.invoke('config:setServerUrl', { serverUrl })) as
      | { success: true; data: string }
      | { success: false; error: string };
    if (result.success) {
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
  if (typeof window === 'undefined' || !window.api) {
    return null;
  }

  try {
    const result = (await window.api.invoke('config:getConfigPath')) as
      | { success: true; data: string }
      | { success: false; error: string };
    if (result.success) {
      return result.data;
    }
    return null;
  } catch {
    return null;
  }
}

export async function initializeServerConfig(): Promise<void> {
  if (typeof window !== 'undefined' && window.api) {
    try {
      const result = (await window.api.invoke('config:getServerUrl')) as
        | { success: true; data: string }
        | { success: false; error: string };
      if (result.success && result.data) {
        cachedServerUrl = result.data;
        const { clearApiConfigCache } = await import('./apiConfig');
        clearApiConfigCache();
      } else {
        cachedServerUrl = null;
      }
    } catch {
      cachedServerUrl = null;
    }
  }
}
