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

function broadcastAimpState(state: AimpBridgeState): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send(AIMP_STATE_CHANGED_CHANNEL, state);
    }
  }
}

function broadcastAimpLog(entry: AimpLogEntry): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send(AIMP_LOG_CHANNEL, entry);
    }
  }
}

export function registerAimpHandlers(): void {
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

  ipcMain.handle('aimp:getState', async () => {
    return {
      success: true,
      data: aimpIntegrationService.getState(),
    };
  });

  ipcMain.handle('aimp:setSourceSelection', async (_event, payload: unknown) => {
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

  ipcMain.handle('aimp:setLiveStreamStarted', async (_event, payload: unknown) => {
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
}

export function unregisterAimpHandlers(): void {
  unsubscribeAimpLog?.();
  unsubscribeAimpLog = null;
  unsubscribeAimpBroadcast?.();
  unsubscribeAimpBroadcast = null;
  hasRegisteredAimpHandlers = false;
}
