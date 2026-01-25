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
          : 'Server URL is not configured. Please set serverUrl in serverConfig.json file in the project root directory.',
      );
    } catch (error) {
      cachedServerUrl = null;
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(
        'Failed to get server URL from config file. Please configure serverUrl in serverConfig.json.',
      );
    }
  }

  throw new Error(
    'Server URL is not configured. Please set VITE_API_URL environment variable or configure serverUrl in serverConfig.json file in the project root directory.',
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
    'Server URL is not configured. Please set VITE_API_URL environment variable or configure serverUrl in serverConfig.json file in the project root directory and restart the application.',
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
