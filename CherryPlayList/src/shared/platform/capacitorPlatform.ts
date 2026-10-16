import { platformUnavailableResponse, throwPlatformUnavailable } from './demoUnavailable';
import type { IPCResponse, PlatformAPI } from './types';

const getWindowApi = (): NonNullable<typeof window.api> | undefined => {
  if (typeof window !== 'undefined' && window.api) {
    return window.api;
  }
  return undefined;
};

const createUnavailableAimpApi = (): PlatformAPI['aimp'] => {
  return {
    getState: () => Promise.resolve(platformUnavailableResponse()),
    setSourceSelection: () => Promise.resolve(platformUnavailableResponse()),
    setLiveStreamStarted: () => Promise.resolve(platformUnavailableResponse()),
    onStateChanged: () => () => undefined,
    onLog: () => () => undefined,
  };
};

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
      return api.invoke(channel, payload);
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
