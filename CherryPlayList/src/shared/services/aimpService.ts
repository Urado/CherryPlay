import type { AimpBridgeState, AimpLogEntry, AimpSourceSelection } from '../contracts/aimp';
import { getPlatform, isPlatformInitialized } from '../platform';
import { getPlatformCapabilities } from '../platform/platformCapabilities';
import { useUIStore } from '../stores/uiStore';
import { logger } from '../utils/logger';

interface AimpIpcResponse {
  success: boolean;
  data?: AimpBridgeState;
  error?: string;
}

class AimpService {
  private assertAimpAvailable(): void {
    if (!isPlatformInitialized() || !getPlatformCapabilities().supportsAimpWorkspace) {
      throw new Error('AIMP integration is only available in the Electron app');
    }
  }

  private async unwrapResponse(promise: Promise<AimpIpcResponse>): Promise<AimpBridgeState> {
    try {
      const response = await promise;
      if (!response.success || !response.data) {
        throw new Error(response.error || 'AIMP IPC call failed');
      }

      return response.data;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown AIMP IPC error';
      logger.error('[AIMP] Renderer IPC call failed', error);
      useUIStore.getState().addNotification({
        type: 'error',
        message: `Ошибка AIMP интеграции: ${message}`,
      });
      throw error;
    }
  }

  async getState(): Promise<AimpBridgeState> {
    this.assertAimpAvailable();
    return this.unwrapResponse(getPlatform().aimp.getState());
  }

  async setSourceSelection(sourceSelection: AimpSourceSelection): Promise<AimpBridgeState> {
    this.assertAimpAvailable();
    return this.unwrapResponse(getPlatform().aimp.setSourceSelection(sourceSelection));
  }

  async setLiveStreamStarted(liveStreamStarted: boolean): Promise<AimpBridgeState> {
    this.assertAimpAvailable();
    return this.unwrapResponse(getPlatform().aimp.setLiveStreamStarted(liveStreamStarted));
  }

  subscribe(listener: (state: AimpBridgeState) => void): () => void {
    this.assertAimpAvailable();
    return getPlatform().aimp.onStateChanged(listener);
  }

  subscribeToLog(listener: (entry: AimpLogEntry) => void): () => void {
    this.assertAimpAvailable();
    return getPlatform().aimp.onLog(listener);
  }
}

export const aimpService = new AimpService();
