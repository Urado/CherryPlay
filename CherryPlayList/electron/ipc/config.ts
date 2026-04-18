import * as fs from 'fs';
import * as path from 'path';

import { app, ipcMain } from 'electron';

interface ServerConfig {
  serverUrl: string;
}

/** Config file name: dev vs packaged app. */
const CONFIG_FILE = {
  development: 'serverConfig.development.json',
  production: 'serverConfig.production.json',
} as const;

function getConfigPath(): string {
  const root = app.isPackaged ? app.getAppPath() : process.cwd();
  const fileName = app.isPackaged ? CONFIG_FILE.production : CONFIG_FILE.development;
  return path.join(root, fileName);
}

function readConfig(): ServerConfig | null {
  const configPath = getConfigPath();

  try {
    if (fs.existsSync(configPath)) {
      const fileContent = fs.readFileSync(configPath, 'utf-8');
      const config = JSON.parse(fileContent) as ServerConfig;

      if (typeof config.serverUrl !== 'string' || !config.serverUrl) {
        throw new Error('Invalid serverUrl in config');
      }

      return config;
    }
  } catch (error) {
    console.error('[Config] Error reading config file:', error);
    throw error;
  }

  return null;
}

function writeConfig(config: ServerConfig): void {
  const configPath = getConfigPath();

  try {
    const configDir = path.dirname(configPath);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    if (typeof config.serverUrl !== 'string' || !config.serverUrl) {
      throw new Error('Invalid serverUrl in config');
    }

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
  } catch (error) {
    console.error('[Config] Error writing config file:', error);
    throw error;
  }
}

export function registerConfigHandlers(): void {
  ipcMain.handle('config:getConfigPath', async () => {
    try {
      const configPath = getConfigPath();
      return {
        success: true,
        data: configPath,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  });

  ipcMain.handle('config:getServerUrl', async () => {
    try {
      const config = readConfig();
      if (!config) {
        return {
          success: false,
          error:
            'Server URL is not configured. Add serverUrl to serverConfig.development.json (dev) or serverConfig.production.json (release build).',
        };
      }
      return {
        success: true,
        data: config.serverUrl,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  });

  ipcMain.handle('config:setServerUrl', async (event, payload: { serverUrl: string }) => {
    try {
      const currentConfig = readConfig();
      const newConfig: ServerConfig = {
        ...(currentConfig ?? {}),
        serverUrl: payload.serverUrl,
      };
      writeConfig(newConfig);
      return {
        success: true,
        data: newConfig.serverUrl,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  });

  ipcMain.handle('config:getConfig', async () => {
    try {
      const config = readConfig();
      if (!config) {
        return {
          success: false,
          error:
            'Server URL is not configured. Add serverUrl to serverConfig.development.json or serverConfig.production.json.',
        };
      }
      return {
        success: true,
        data: config,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  });
}
