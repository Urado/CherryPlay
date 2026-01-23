import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('api', {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  invoke: (channel: string, payload?: any) => {
    // Whitelist channels for security
    const validChannels = [
      // File browser channels
      'fileBrowser:listDirectory',
      'fileBrowser:statFile',
      'fileBrowser:findAudioFilesRecursive',
      // Audio channels
      'audio:getDuration',
      'audio:getFileSource',
      // Export channels
      'export:execute',
      'export:copyFile',
      'export:aimp',
      'export:copyTracksToFolder',
      // Project channels
      'project:save',
      'project:load',
      // Plugin channels
      'plugins:list',
      // Dialog channels
      'dialog:showOpenDialog',
      'dialog:showSaveDialog',
      'dialog:showOpenFileDialog',
      // System channels
      'system:getPath',
    ];

    if (validChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, payload);
    }

    return Promise.reject(new Error(`Invalid IPC channel: ${channel}`));
  },
});

// Type declaration for TypeScript
export {};

declare global {
  interface Window {
    api: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      invoke: (channel: string, payload?: any) => Promise<any>;
    };
  }
}
