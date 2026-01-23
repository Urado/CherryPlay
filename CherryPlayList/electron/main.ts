import * as path from 'path';
import { fileURLToPath } from 'url';

import { app, BrowserWindow, Menu, session } from 'electron';

import { registerAudioHandlers } from './ipc/audio.js';
import { registerDialogHandlers } from './ipc/dialogs.js';
import { registerExportHandlers } from './ipc/export.js';
import { registerFileBrowserHandlers } from './ipc/fileBrowser.js';
import { registerPlaylistHandlers } from './ipc/playlist.js';
import { registerProjectHandlers } from './ipc/project.js';
import { registerSystemHandlers } from './ipc/system.js';

// ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Keep a global reference of the window object
let mainWindow: BrowserWindow | null = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function createWindow(): void {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webviewTag: false,
      // Отключаем webSecurity для разработки, чтобы разрешить подключения к localhost:5000
      webSecurity: !isDev,
    },
  });

  // Load the app
  if (isDev) {
    // Development: load from Vite dev server
    mainWindow.loadURL('http://localhost:5173');
    // Open DevTools in development
    mainWindow.webContents.openDevTools();
  } else {
    // Production: load from built files
    const indexHtmlPath = path.join(app.getAppPath(), 'dist/index.html');
    mainWindow.loadFile(indexHtmlPath);
  }

  // Emitted when the window is closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// This method will be called when Electron has finished initialization
app.whenReady().then(() => {
  // Скрываем нативное меню приложения
  Menu.setApplicationMenu(null);
  // Настройка Content Security Policy для разрешения подключений к localhost:5000 и Google Fonts
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: http://localhost:* ws://localhost:* wss://localhost:* https://fonts.googleapis.com https://fonts.gstatic.com; " +
            "connect-src 'self' http://localhost:* ws://localhost:* wss://localhost:* https://fonts.googleapis.com https://fonts.gstatic.com; " +
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
            "font-src 'self' data: https://fonts.gstatic.com;",
        ],
      },
    });
  });

  // Register IPC handlers
  registerFileBrowserHandlers();
  registerAudioHandlers();
  registerDialogHandlers();
  registerSystemHandlers();
  registerExportHandlers();
  registerProjectHandlers();
  registerPlaylistHandlers();

  createWindow();

  app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed
app.on('window-all-closed', () => {
  // On macOS, applications and their menu bar typically stay active
  // until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
