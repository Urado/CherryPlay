import * as path from 'path';
import { fileURLToPath } from 'url';

import { app, BrowserWindow, Menu, session } from 'electron';

import { registerAudioHandlers } from './ipc/audio.js';
import { registerConfigHandlers } from './ipc/config.js';
import { registerDialogHandlers } from './ipc/dialogs.js';
import { registerExportHandlers } from './ipc/export.js';
import { registerFileBrowserHandlers } from './ipc/fileBrowser.js';
import { registerPlaylistHandlers } from './ipc/playlist.js';
import { registerProjectHandlers } from './ipc/project.js';
import { registerSystemHandlers } from './ipc/system.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function createWindow(): void {
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
      webSecurity: !isDev,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    const indexHtmlPath = path.join(app.getAppPath(), 'dist/index.html');
    mainWindow.loadFile(indexHtmlPath);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const csp = [
      "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: http://localhost:* ws://localhost:* wss://localhost:* http://*:* https://*:* ws://*:* wss://*:* https://fonts.googleapis.com https://fonts.gstatic.com; " +
        "connect-src 'self' http://localhost:* ws://localhost:* wss://localhost:* http://*:* https://*:* ws://*:* wss://*:* https://fonts.googleapis.com https://fonts.gstatic.com; " +
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
        "font-src 'self' data: https://fonts.gstatic.com;",
    ];
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': csp,
      },
    });
  });

  registerFileBrowserHandlers();
  registerAudioHandlers();
  registerDialogHandlers();
  registerSystemHandlers();
  registerConfigHandlers();
  registerExportHandlers();
  registerProjectHandlers();
  registerPlaylistHandlers();

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
