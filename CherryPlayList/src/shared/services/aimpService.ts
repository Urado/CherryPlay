import type { AimpBridgeState, AimpLogEntry, AimpSourceSelection } from '../contracts/aimp';
import { getPlatform, isPlatformInitialized } from '../platform';
import { getPlatformCapabilities } from '../platform/platformCapabilities';
import type { DemoAimpPlaylistSize } from '../platform/types';
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
      throw new Error('AIMP integration is not available on this platform');
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

  async setDemoPlaylistSize(size: DemoAimpPlaylistSize): Promise<AimpBridgeState> {
    this.assertAimpAvailable();
    const setDemoPlaylistSize = getPlatform().aimp.setDemoPlaylistSize;
    if (!setDemoPlaylistSize) {
      throw new Error('AIMP playlist size simulation is only available in web demo');
    }
    return this.unwrapResponse(setDemoPlaylistSize(size));
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
