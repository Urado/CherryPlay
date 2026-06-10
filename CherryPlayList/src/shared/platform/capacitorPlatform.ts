import { platformUnavailableResponse, throwPlatformUnavailable } from './demoUnavailable';
import type { IPCResponse, PlatformAPI } from './types';

function getWindowApi(): NonNullable<typeof window.api> | undefined {
  if (typeof window !== 'undefined' && window.api) {
    return window.api;
  }
  return undefined;
}

function createUnavailableAimpApi(): PlatformAPI['aimp'] {
  return {
    getState: async () => platformUnavailableResponse(),
    setSourceSelection: async () => platformUnavailableResponse(),
    setLiveStreamStarted: async () => platformUnavailableResponse(),
    onStateChanged: () => () => undefined,
    onLog: () => () => undefined,
  };
}

/**
 * Capacitor/Android platform stub. Delegates to `window.api` when the bridge is injected;
 * otherwise returns controlled unavailable responses until native plugins land.
 */
export class CapacitorPlatform implements PlatformAPI {
  getPathForFile(file: File): string {
    const api = getWindowApi();
    if (api) {
      return api.getPathForFile(file);
    }
    throwPlatformUnavailable();
  }

  invoke(channel: string, payload?: object): Promise<IPCResponse<unknown>> {
    const api = getWindowApi();
    if (api) {
      return api.invoke(channel, payload) as Promise<IPCResponse<unknown>>;
    }
    return Promise.resolve(platformUnavailableResponse());
  }

  on(channel: string, listener: (event: unknown, ...args: unknown[]) => void): () => void {
    const api = getWindowApi();
    if (api) {
      return api.on(channel, listener);
    }
    return () => undefined;
  }

  get aimp(): PlatformAPI['aimp'] {
    return createUnavailableAimpApi();
  }
}
