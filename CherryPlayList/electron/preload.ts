import { contextBridge, ipcRenderer, webUtils } from 'electron';

import {
  isAimpSourceSelection,
  validateAimpBridgeState,
  validateAimpBridgeStateResponse,
  validateAimpLiveStreamPayload,
  validateAimpSourceSelectionPayload,
  type AimpBridgeState,
  type AimpLogEntry,
  type AimpSourceSelection,
} from '../src/shared/contracts/aimp';

function assertBoolean(value: unknown, fieldName: string): asserts value is boolean {
  if (typeof value !== 'boolean') {
    throw new Error(`${fieldName} must be a boolean`);
  }
}

function assertAimpSourceSelection(value: unknown): asserts value is AimpSourceSelection {
  if (!isAimpSourceSelection(value)) {
    throw new Error('sourceSelection must be "cherryPlayPlayer" or "aimp"');
  }
}

const VALID_INVOKE_CHANNELS = [
  'fileBrowser:listDirectory',
  'fileBrowser:statFile',
  'fileBrowser:findAudioFilesRecursive',
  'audio:getDuration',
  'audio:getFileUrl',
  'export:execute',
  'export:copyFile',
  'export:aimp',
  'export:copyTracksToFolder',
  'project:save',
  'project:savePortableAs',
  'project:load',
  'plugins:list',
  'dialog:showOpenDialog',
  'dialog:showSaveDialog',
  'dialog:showOpenFileDialog',
  'system:getPath',
  'system:openPath',
  'system:openExternal',
  'system:setMinimumWindowSize',
  'config:getConfigPath',
  'config:getServerUrl',
  'config:setServerUrl',
  'config:getConfig',
  'auth:openExternal',
  'auth:registerCallback',
  'settings:saveBundle',
  'settings:loadBundle',
] as const;

const VALID_ON_CHANNELS = ['project:save-progress'] as const;

function assertValidInvokeChannel(channel: string): void {
  if (!(VALID_INVOKE_CHANNELS as readonly string[]).includes(channel)) {
    throw new Error(`Invalid IPC channel: ${channel}`);
  }
}

function assertValidOnChannel(channel: string): void {
  if (!(VALID_ON_CHANNELS as readonly string[]).includes(channel)) {
    throw new Error(`Invalid IPC channel: ${channel}`);
  }
}

async function invokeValidatedAimpChannel(
  channel: 'aimp:getState' | 'aimp:setSourceSelection' | 'aimp:setLiveStreamStarted',
  payload?: unknown,
): Promise<{
  success: boolean;
  data?: AimpBridgeState;
  error?: string;
}> {
  const response = await ipcRenderer.invoke(channel, payload);
  const validationResult = validateAimpBridgeStateResponse(response);
  if (!validationResult.success) {
    throw new Error(validationResult.error.message);
  }

  return validationResult.value;
}

function assertValidAimpState(state: unknown): AimpBridgeState {
  const validationResult = validateAimpBridgeState(state);
  if (!validationResult.success) {
    throw new Error(validationResult.error.message);
  }

  return validationResult.value;
}

contextBridge.exposeInMainWorld('api', {
  getPathForFile: (file: File) => {
    if (!file || typeof file !== 'object') {
      throw new Error('getPathForFile: expected a File object');
    }
    return webUtils.getPathForFile(file);
  },

  invoke: (channel: string, payload?: object) => {
    assertValidInvokeChannel(channel);
    return ipcRenderer.invoke(channel, payload);
  },

  on: (
    channel: string,
    listener: (event: Electron.IpcRendererEvent, ...args: unknown[]) => void,
  ) => {
    assertValidOnChannel(channel);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },

  aimp: {
    getState: () => invokeValidatedAimpChannel('aimp:getState'),
    setSourceSelection: (sourceSelection: AimpSourceSelection) => {
      assertAimpSourceSelection(sourceSelection);
      const validationResult = validateAimpSourceSelectionPayload({
        sourceSelection,
      });
      if (!validationResult.success) {
        throw new Error(validationResult.error.message);
      }

      return invokeValidatedAimpChannel('aimp:setSourceSelection', validationResult.value);
    },
    setLiveStreamStarted: (liveStreamStarted: boolean) => {
      assertBoolean(liveStreamStarted, 'liveStreamStarted');
      const validationResult = validateAimpLiveStreamPayload({
        liveStreamStarted,
      });
      if (!validationResult.success) {
        throw new Error(validationResult.error.message);
      }

      return invokeValidatedAimpChannel('aimp:setLiveStreamStarted', validationResult.value);
    },
    onStateChanged: (listener: (state: AimpBridgeState) => void) => {
      const wrappedListener = (_event: Electron.IpcRendererEvent, state: unknown) => {
        listener(assertValidAimpState(state));
      };

      ipcRenderer.on('aimp:state-changed', wrappedListener);
      return () => ipcRenderer.removeListener('aimp:state-changed', wrappedListener);
    },
    onLog: (listener: (entry: AimpLogEntry) => void) => {
      const wrappedListener = (_event: Electron.IpcRendererEvent, entry: AimpLogEntry) => {
        listener(entry);
      };
      ipcRenderer.on('aimp:log', wrappedListener);
      return () => ipcRenderer.removeListener('aimp:log', wrappedListener);
    },
  },
});

export {};

declare global {
  interface Window {
    api: {
      getPathForFile: (file: File) => string;
      invoke: (channel: string, payload?: object) => ReturnType<typeof ipcRenderer.invoke>;
      on: (channel: string, listener: (event: unknown, ...args: unknown[]) => void) => () => void;
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
