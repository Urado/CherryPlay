import * as fs from 'fs';
import * as path from 'path';

import { app, ipcMain } from 'electron';

interface ServerConfig {
  serverUrl: string;
}

function getConfigPath(): string {
  if (app.isPackaged) {
    return path.join(app.getAppPath(), 'serverConfig.json');
  } else {
    const projectRoot = process.cwd();
    const configPath = path.join(projectRoot, 'serverConfig.json');
    return configPath;
  }
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
            'Server URL is not configured. Please create serverConfig.json file in the project root directory with serverUrl field. See serverConfig.example.json for reference.',
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
        ...currentConfig,
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
            'Server URL is not configured. Please create serverConfig.json file in the project root directory with serverUrl field.',
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
