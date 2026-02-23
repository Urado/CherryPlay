/**
 * Global type declarations for the renderer process
 */

/** App version injected at build time from package.json */
declare const __APP_VERSION__: string;

// Window API exposed by electron preload
declare global {
  interface Window {
    api: {
      invoke: <T = unknown>(channel: string, payload?: unknown) => Promise<T>;
    };
  }
}

export {};
