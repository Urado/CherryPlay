import { useUIStore } from '../stores/uiStore';
import { logger } from '../utils/logger';

export interface IPCResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface DirectoryItem {
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
}

export interface Track {
  id: string;
  path: string;
  name: string;
  duration?: number;
}

interface AudioFileSource {
  buffer: string;
  mimeType: string;
}

export function isIpcRendererAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.api !== 'undefined';
}

class IPCService {
  async invoke<T>(
    channel: string,
    payload?: unknown,
    showNotification: boolean = true,
  ): Promise<T> {
    if (!isIpcRendererAvailable()) {
      const error = new Error('IPC API not available');
      if (showNotification) {
        useUIStore.getState().addNotification({
          type: 'error',
          message: 'Ошибка: IPC API недоступен',
        });
      }
      throw error;
    }

    try {
      const response: IPCResponse<T> = await window.api.invoke(channel, payload);

      if (!response.success) {
        const error = new Error(response.error || 'IPC call failed');
        if (showNotification) {
          useUIStore.getState().addNotification({
            type: 'error',
            message: `Ошибка: ${response.error || 'Неизвестная ошибка'}`,
          });
        }
        throw error;
      }

      return response.data as T;
    } catch (error) {
      logger.error(`IPC call failed: ${channel}`, error);

      if (showNotification && error instanceof Error) {
        if (
          !error.message.includes('IPC API not available') &&
          !error.message.includes('IPC call failed')
        ) {
          useUIStore.getState().addNotification({
            type: 'error',
            message: `Ошибка: ${error.message || 'Неизвестная ошибка'}`,
          });
        }
      }

      throw error;
    }
  }

  async listDirectory(path: string): Promise<DirectoryItem[]> {
    return this.invoke<DirectoryItem[]>('fileBrowser:listDirectory', { path });
  }

  async statFile(
    path: string,
    showNotification: boolean = true,
  ): Promise<{
    size: number;
    modified: number;
    isDirectory: boolean;
  }> {
    return this.invoke('fileBrowser:statFile', { path }, showNotification);
  }

  async findAudioFilesRecursive(path: string): Promise<string[]> {
    return this.invoke<string[]>('fileBrowser:findAudioFilesRecursive', { path });
  }

  async getAudioDuration(path: string, showNotification: boolean = false): Promise<number> {
    return this.invoke<number>('audio:getDuration', { path }, showNotification);
  }

  async getAudioFileSource(
    path: string,
    showNotification: boolean = true,
  ): Promise<AudioFileSource> {
    return this.invoke<AudioFileSource>('audio:getFileSource', { path }, showNotification);
  }

  async showFolderDialog(options?: {
    title?: string;
    defaultPath?: string;
  }): Promise<string | null> {
    return this.invoke<string | null>('dialog:showOpenDialog', options || {});
  }

  async showSaveDialog(options?: {
    title?: string;
    defaultPath?: string;
    filters?: Array<{ name: string; extensions: string[] }>;
  }): Promise<string | null> {
    return this.invoke<string | null>('dialog:showSaveDialog', options || {});
  }

  async showOpenFileDialog(options?: {
    title?: string;
    defaultPath?: string;
    filters?: Array<{ name: string; extensions: string[] }>;
  }): Promise<string | null> {
    return this.invoke<string | null>('dialog:showOpenFileDialog', options || {});
  }

  async getSystemPath(name: string): Promise<string> {
    return this.invoke<string>('system:getPath', { name });
  }

  /**
   * Открывает файл или папку в ассоциированном приложении (Проводник для каталога).
   */
  async openPath(fileOrFolderPath: string): Promise<void> {
    return this.invoke<void>('system:openPath', { path: fileOrFolderPath });
  }
}

export const ipcService = new IPCService();
