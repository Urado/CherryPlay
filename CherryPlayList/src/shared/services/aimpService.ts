import type { AimpBridgeState, AimpLogEntry, AimpSourceSelection } from '../contracts/aimp';
import { useUIStore } from '../stores/uiStore';
import { logger } from '../utils/logger';

interface AimpIpcResponse {
  success: boolean;
  data?: AimpBridgeState;
  error?: string;
}

class AimpService {
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
    return this.unwrapResponse(window.api.aimp.getState());
  }

  async setSourceSelection(sourceSelection: AimpSourceSelection): Promise<AimpBridgeState> {
    return this.unwrapResponse(window.api.aimp.setSourceSelection(sourceSelection));
  }

  async setLiveStreamStarted(liveStreamStarted: boolean): Promise<AimpBridgeState> {
    return this.unwrapResponse(window.api.aimp.setLiveStreamStarted(liveStreamStarted));
  }

  subscribe(listener: (state: AimpBridgeState) => void): () => void {
    return window.api.aimp.onStateChanged(listener);
  }

  subscribeToLog(listener: (entry: AimpLogEntry) => void): () => void {
    return window.api.aimp.onLog(listener);
  }
}

export const aimpService = new AimpService();
