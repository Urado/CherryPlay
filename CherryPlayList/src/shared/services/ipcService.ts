/**
 * IPC Service - wrapper for Electron IPC communication
 */

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

class IPCService {
  /**
   * Generic IPC invoke method
   * @param channel - IPC channel name
   * @param payload - Optional payload to send
   * @param showNotification - Whether to show error notification (default: true)
   * @returns Promise with response data
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async invoke<T>(channel: string, payload?: any, showNotification: boolean = true): Promise<T> {
    if (!window.api) {
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

      // Show notification if not already shown and showNotification is true
      if (showNotification && error instanceof Error) {
        // Only show if it's not an error we already handled
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

  /**
   * List directory contents
   */
  async listDirectory(path: string): Promise<DirectoryItem[]> {
    return this.invoke<DirectoryItem[]>('fileBrowser:listDirectory', { path });
  }

  /**
   * Get file/directory stats
   */
  async statFile(path: string): Promise<{
    size: number;
    modified: number;
    isDirectory: boolean;
  }> {
    return this.invoke('fileBrowser:statFile', { path });
  }

  /**
   * Find all audio files recursively in a directory
   */
  async findAudioFilesRecursive(path: string): Promise<string[]> {
    return this.invoke<string[]>('fileBrowser:findAudioFilesRecursive', { path });
  }

  /**
   * Get audio file duration in seconds
   */
  async getAudioDuration(path: string): Promise<number> {
    return this.invoke<number>('audio:getDuration', { path });
  }

  /**
   * Get audio file contents as base64 buffer for secure playback
   */
  async getAudioFileSource(
    path: string,
    showNotification: boolean = true,
  ): Promise<AudioFileSource> {
    return this.invoke<AudioFileSource>('audio:getFileSource', { path }, showNotification);
  }

  /**
   * Show folder selection dialog
   */
  async showFolderDialog(options?: {
    title?: string;
    defaultPath?: string;
  }): Promise<string | null> {
    return this.invoke<string | null>('dialog:showOpenDialog', options || {});
  }

  /**
   * Show save file dialog
   */
  async showSaveDialog(options?: {
    title?: string;
    defaultPath?: string;
    filters?: Array<{ name: string; extensions: string[] }>;
  }): Promise<string | null> {
    return this.invoke<string | null>('dialog:showSaveDialog', options || {});
  }

  /**
   * Show open file dialog
   */
  async showOpenFileDialog(options?: {
    title?: string;
    defaultPath?: string;
    filters?: Array<{ name: string; extensions: string[] }>;
  }): Promise<string | null> {
    return this.invoke<string | null>('dialog:showOpenFileDialog', options || {});
  }

  /**
   * Get system path (documents, music, downloads, etc.)
   */
  async getSystemPath(name: string): Promise<string> {
    return this.invoke<string>('system:getPath', { name });
  }
}

export const ipcService = new IPCService();
