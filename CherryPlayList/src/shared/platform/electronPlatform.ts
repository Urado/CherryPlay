import type { PlatformAPI } from './types';

function assertWindowApi(): NonNullable<typeof window.api> {
  if (typeof window === 'undefined' || !window.api) {
    throw new Error('Electron preload API (window.api) is not available');
  }
  return window.api;
}

export class ElectronPlatform implements PlatformAPI {
  getPathForFile(file: File): string {
    return assertWindowApi().getPathForFile(file);
  }

  invoke(channel: string, payload?: object): Promise<import('./types').IPCResponse<unknown>> {
    return assertWindowApi().invoke(channel, payload) as Promise<
      import('./types').IPCResponse<unknown>
    >;
  }

  on(channel: string, listener: (event: unknown, ...args: unknown[]) => void): () => void {
    return assertWindowApi().on(channel, listener);
  }

  get aimp(): PlatformAPI['aimp'] {
    return assertWindowApi().aimp;
  }
}
