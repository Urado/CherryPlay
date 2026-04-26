/**
 * Global type declarations for the renderer process
 */

import type { AimpBridgeState, AimpLogEntry, AimpSourceSelection } from './shared/contracts/aimp';

/** App version injected at build time from package.json */
declare const __APP_VERSION__: string;

// Window API exposed by electron preload
declare global {
  interface Window {
    api: {
      invoke: <T = unknown>(channel: string, payload?: unknown) => Promise<T>;
      on: (channel: string, listener: (event: unknown, ...args: unknown[]) => void) => () => void;
      getPathForFile: (file: File) => string;
      aimp: {
        getState: () => Promise<{ success: boolean; data?: AimpBridgeState; error?: string }>;
        setSourceSelection: (
          sourceSelection: AimpSourceSelection,
        ) => Promise<{ success: boolean; data?: AimpBridgeState; error?: string }>;
        setLiveStreamStarted: (
          liveStreamStarted: boolean,
        ) => Promise<{ success: boolean; data?: AimpBridgeState; error?: string }>;
        onStateChanged: (listener: (state: AimpBridgeState) => void) => () => void;
        onLog: (listener: (entry: AimpLogEntry) => void) => () => void;
      };
    };
  }
}

export {};
