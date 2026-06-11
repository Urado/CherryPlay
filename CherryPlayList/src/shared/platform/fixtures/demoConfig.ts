let demoServerUrl =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || 'http://localhost:5000';

/** Demo defaults applied on bootstrap (see demoReset / bootstrap). */
export const DEMO_DEFAULT_ENABLE_STREAMING = true;

export function getDemoServerUrl(): string {
  return demoServerUrl;
}

export function setDemoServerUrl(url: string): void {
  demoServerUrl = url;
}

export function getDemoConfigPath(): string {
  return '/demo/config/serverConfig.json';
}
