const configuredApiUrl: unknown = import.meta.env?.VITE_API_URL;
let demoServerUrl = typeof configuredApiUrl === 'string' ? configuredApiUrl : '';

export const DEMO_DEFAULT_ENABLE_STREAMING = true;

export const getDemoServerUrl = (): string => {
  return demoServerUrl;
}

export const setDemoServerUrl = (url: string): void => {
  demoServerUrl = url;
}

export const getDemoConfigPath = (): string => {
  return '/demo/config/serverConfig.json';
}
