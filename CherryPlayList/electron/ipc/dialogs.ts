import { ipcMain, dialog, BrowserWindow } from 'electron';

/**
 * Show open dialog for selecting a folder
 */
async function showOpenDialog(options: {
  title?: string;
  defaultPath?: string;
}): Promise<string | null> {
  const mainWindow = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];

  const result = await dialog.showOpenDialog(mainWindow, {
    title: options.title || 'Select Folder',
    defaultPath: options.defaultPath,
    properties: ['openDirectory'],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0];
}

/**
 * Show save dialog for saving a file
 */
async function showSaveDialog(options: {
  title?: string;
  defaultPath?: string;
  filters?: Array<{ name: string; extensions: string[] }>;
}): Promise<string | null> {
  const mainWindow = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];

  const result = await dialog.showSaveDialog(mainWindow, {
    title: options.title || 'Save File',
    defaultPath: options.defaultPath,
    filters: options.filters,
  });

  if (result.canceled || !result.filePath) {
    return null;
  }

  return result.filePath;
}

/**
 * Show open dialog for selecting a file
 */
async function showOpenFileDialog(options: {
  title?: string;
  defaultPath?: string;
  filters?: Array<{ name: string; extensions: string[] }>;
}): Promise<string | null> {
  const mainWindow = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];

  const result = await dialog.showOpenDialog(mainWindow, {
    title: options.title || 'Select File',
    defaultPath: options.defaultPath,
    properties: ['openFile'],
    filters: options.filters,
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0];
}

/**
 * Register dialog IPC handlers
 */
export function registerDialogHandlers(): void {
  ipcMain.handle(
    'dialog:showOpenDialog',
    async (
      event,
      payload: {
        title?: string;
        defaultPath?: string;
      },
    ) => {
      try {
        const path = await showOpenDialog(payload);
        return {
          success: true,
          data: path,
        };
      } catch (error) {
        return {
          success: false,
          error: (error as Error).message,
        };
      }
    },
  );

  ipcMain.handle(
    'dialog:showSaveDialog',
    async (
      event,
      payload: {
        title?: string;
        defaultPath?: string;
        filters?: Array<{ name: string; extensions: string[] }>;
      },
    ) => {
      try {
        const path = await showSaveDialog(payload);
        return {
          success: true,
          data: path,
        };
      } catch (error) {
        return {
          success: false,
          error: (error as Error).message,
        };
      }
    },
  );

  ipcMain.handle(
    'dialog:showOpenFileDialog',
    async (
      event,
      payload: {
        title?: string;
        defaultPath?: string;
        filters?: Array<{ name: string; extensions: string[] }>;
      },
    ) => {
      try {
        const path = await showOpenFileDialog(payload);
        return {
          success: true,
          data: path,
        };
      } catch (error) {
        return {
          success: false,
          error: (error as Error).message,
        };
      }
    },
  );
}
