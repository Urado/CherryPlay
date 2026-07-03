import * as path from 'path';
import { fileURLToPath } from 'url';

import { app, BrowserWindow, Menu, session } from 'electron';

import { aimpIntegrationService } from './aimp/service.js';
import { registerAimpHandlers } from './ipc/aimp.js';
import { registerAudioHandlers } from './ipc/audio.js';
import { registerAuthHandlers, handleOAuthCallback } from './ipc/auth.js';
import { registerConfigHandlers } from './ipc/config.js';
import { registerDialogHandlers } from './ipc/dialogs.js';
import { registerExportHandlers } from './ipc/export.js';
import { registerFileBrowserHandlers } from './ipc/fileBrowser.js';
import { registerPlaylistHandlers } from './ipc/playlist.js';
import { registerProjectHandlers } from './ipc/project.js';
import { registerSettingsBundleHandlers } from './ipc/settingsBundle.js';
import { registerSystemHandlers } from './ipc/system.js';
import {
  registerCherryplayAudioProtocolHandler,
  registerCherryplayAudioScheme,
} from './protocol/cherryplayAudio.js';

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

// Регистрация custom URL scheme для OAuth callback
const PROTOCOL = 'cherryplaylist';

// Регистрируем protocol только если приложение не упаковано или в dev режиме
if (!app.isDefaultProtocolClient(PROTOCOL)) {
  app.setAsDefaultProtocolClient(PROTOCOL);
}

registerCherryplayAudioScheme();

app.whenReady().then(() => {
  registerCherryplayAudioProtocolHandler();

  Menu.setApplicationMenu(null);
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const csp = [
      "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: cherryplay-audio: http://localhost:* ws://localhost:* wss://localhost:* http://*:* https://*:* ws://*:* wss://*:* https://fonts.googleapis.com https://fonts.gstatic.com; " +
        "connect-src 'self' http://localhost:* ws://localhost:* wss://localhost:* http://*:* https://*:* ws://*:* wss://*:* https://fonts.googleapis.com https://fonts.gstatic.com; " +
        "media-src cherryplay-audio: blob: 'self'; " +
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
  registerAimpHandlers();
  registerAudioHandlers();
  registerDialogHandlers();
  registerSystemHandlers();
  registerConfigHandlers();
  registerExportHandlers();
  registerProjectHandlers();
  registerPlaylistHandlers();
  registerSettingsBundleHandlers();
  registerAuthHandlers(mainWindow);

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Обработка OAuth callback через custom URL scheme
// macOS
app.on('open-url', (event, url) => {
  event.preventDefault();
  handleOAuthCallback(url, mainWindow);
});

// Windows/Linux - обрабатываем аргументы командной строки
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, commandLine) => {
    // Обрабатываем URL из второго экземпляра
    const url = commandLine.find((arg) => arg.startsWith(`${PROTOCOL}://`));
    if (url) {
      handleOAuthCallback(url, mainWindow);
    }
    // Фокусируемся на главном окне
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

// Обрабатываем URL при запуске приложения (Windows/Linux)
if (process.platform !== 'darwin') {
  const url = process.argv.find((arg) => arg.startsWith(`${PROTOCOL}://`));
  if (url) {
    handleOAuthCallback(url, mainWindow);
  }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  aimpIntegrationService.dispose();
});
