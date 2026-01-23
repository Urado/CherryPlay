/**
 * Global type declarations for the renderer process
 */

// Window API exposed by electron preload
declare global {
  interface Window {
    api: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      invoke: (channel: string, payload?: any) => Promise<any>;
    };
  }
}

export {};
