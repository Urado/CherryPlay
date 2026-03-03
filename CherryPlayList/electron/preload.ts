import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  invoke: (channel: string, payload?: object) => {
    const validChannels = [
      'fileBrowser:listDirectory',
      'fileBrowser:statFile',
      'fileBrowser:findAudioFilesRecursive',
      'audio:getDuration',
      'audio:getFileSource',
      'export:execute',
      'export:copyFile',
      'export:aimp',
      'export:copyTracksToFolder',
      'project:save',
      'project:load',
      'plugins:list',
      'dialog:showOpenDialog',
      'dialog:showSaveDialog',
      'dialog:showOpenFileDialog',
      'system:getPath',
      'system:openExternal',
      'config:getConfigPath',
      'config:getServerUrl',
      'config:setServerUrl',
      'config:getConfig',
      'auth:openExternal',
      'auth:registerCallback',
    ];

    if (validChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, payload);
    }

    return Promise.reject(new Error(`Invalid IPC channel: ${channel}`));
  },

  on: (
    channel: string,
    listener: (event: Electron.IpcRendererEvent, ...args: unknown[]) => void,
  ) => {
    const validChannels = ['project:save-progress'];

    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, listener);
      return () => ipcRenderer.removeListener(channel, listener);
    }

    throw new Error(`Invalid IPC channel: ${channel}`);
  },
});

export {};

declare global {
  interface Window {
    api: {
      invoke: (channel: string, payload?: object) => ReturnType<typeof ipcRenderer.invoke>;
      on: (channel: string, listener: (event: unknown, ...args: unknown[]) => void) => () => void;
    };
  }
}
