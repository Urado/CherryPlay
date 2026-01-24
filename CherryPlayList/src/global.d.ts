/**
 * Global type declarations for the renderer process
 */

// Window API exposed by electron preload
declare global {
  interface Window {
    api: {
      invoke: <T = unknown>(channel: string, payload?: unknown) => Promise<T>;
    };
  }
}

export {};
