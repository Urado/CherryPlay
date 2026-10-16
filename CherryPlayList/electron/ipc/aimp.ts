import { BrowserWindow, ipcMain } from 'electron';

import {
  AimpBridgeState,
  validateAimpLiveStreamPayload,
  validateAimpSourceSelectionPayload,
} from '../../src/shared/contracts/aimp.js';
import { aimpIntegrationService, type AimpLogEntry } from '../aimp/service.js';

const AIMP_STATE_CHANGED_CHANNEL = 'aimp:state-changed';
const AIMP_LOG_CHANNEL = 'aimp:log';

let hasRegisteredAimpHandlers = false;
let unsubscribeAimpBroadcast: (() => void) | null = null;
let unsubscribeAimpLog: (() => void) | null = null;

const broadcastAimpState = (state: AimpBridgeState): void => {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send(AIMP_STATE_CHANGED_CHANNEL, state);
    }
  }
};

const broadcastAimpLog = (entry: AimpLogEntry): void => {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send(AIMP_LOG_CHANNEL, entry);
    }
  }
};

export const registerAimpHandlers = (): void => {
  if (hasRegisteredAimpHandlers) {
    return;
  }

  hasRegisteredAimpHandlers = true;
  unsubscribeAimpBroadcast = aimpIntegrationService.subscribe((state) => {
    broadcastAimpState(state);
  });
  unsubscribeAimpLog = aimpIntegrationService.subscribeLog((entry) => {
    broadcastAimpLog(entry);
  });

  ipcMain.handle('aimp:getState', () => {
    return {
      success: true,
      data: aimpIntegrationService.getState(),
    };
  });

  ipcMain.handle('aimp:setSourceSelection', (_event, payload: unknown) => {
    const validationResult = validateAimpSourceSelectionPayload(payload);
    if (!validationResult.success) {
      return {
        success: false,
        error: validationResult.error.message,
      };
    }

    return {
      success: true,
      data: aimpIntegrationService.setSourceSelection(validationResult.value.sourceSelection),
    };
  });

  ipcMain.handle('aimp:setLiveStreamStarted', (_event, payload: unknown) => {
    const validationResult = validateAimpLiveStreamPayload(payload);
    if (!validationResult.success) {
      return {
        success: false,
        error: validationResult.error.message,
      };
    }

    try {
      return {
        success: true,
        data: aimpIntegrationService.setLiveStreamStarted(validationResult.value.liveStreamStarted),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update AIMP live stream state',
      };
    }
  });
};

export const unregisterAimpHandlers = (): void => {
  unsubscribeAimpLog?.();
  unsubscribeAimpLog = null;
  unsubscribeAimpBroadcast?.();
  unsubscribeAimpBroadcast = null;
  hasRegisteredAimpHandlers = false;
};
