import type { LoudnessAnalyzeResult } from '../contracts/loudness';
import { DEMO_UNAVAILABLE_MESSAGE } from '../platform/demoUnavailable';
import { getPlatformCapabilities } from '../platform/platformCapabilities';
import { getPlatform, isPlatformInitialized } from '../platform/platformContext';
import type { AudioFileStat, DirectoryItem, IPCResponse } from '../platform/types';
import { useUIStore } from '../stores/uiStore';
import { isFileNotFoundError } from '../utils/fileErrors';
import { logger } from '../utils/logger';

export type { DirectoryItem, IPCResponse };

export interface Track {
  id: string;
  path: string;
  name: string;
  duration?: number;
}

interface AudioFileUrl {
  url: string;
}

/** @deprecated Use {@link getPlatformCapabilities} for feature gating. */
export function isIpcRendererAvailable(): boolean {
  if (!isPlatformInitialized()) {
    return false;
  }
  return getPlatformCapabilities().supportsAimpWorkspace;
}

class IPCService {
  async invoke<T>(
    channel: string,
    payload?: unknown,
    showNotification: boolean = true,
  ): Promise<T> {
    if (!isPlatformInitialized()) {
      const error = new Error('Platform API not available');
      if (showNotification) {
        useUIStore.getState().addNotification({
          type: 'error',
          message: 'Ошибка: IPC API недоступен',
        });
      }
      throw error;
    }

    try {
      const response: IPCResponse<T> = (await getPlatform().invoke(
        channel,
        payload as object | undefined,
      )) as IPCResponse<T>;

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
      const missingFile = isFileNotFoundError(error);
      if (missingFile && !showNotification) {
        logger.warn(`File not found (${channel})`, error);
      } else {
        logger.error(`IPC call failed: ${channel}`, error);
      }

      if (showNotification && error instanceof Error) {
        if (missingFile) {
          useUIStore.getState().addNotification({
            type: 'warning',
            message: 'Файл не найден на диске. Проверьте путь к треку.',
          });
        } else if (
          !error.message.includes('Platform API not available') &&
          !error.message.includes('IPC call failed') &&
          error.message !== DEMO_UNAVAILABLE_MESSAGE
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

  async getAudioFileUrl(path: string, showNotification: boolean = true): Promise<AudioFileUrl> {
    return this.invoke<AudioFileUrl>('audio:getFileUrl', { path }, showNotification);
  }

  async analyzeLoudness(
    path: string,
    targetLufs: number,
    showNotification: boolean = false,
  ): Promise<LoudnessAnalyzeResult> {
    return this.invoke<LoudnessAnalyzeResult>(
      'audio:analyzeLoudness',
      { path, targetLufs },
      showNotification,
    );
  }

  async statAudioFile(path: string, showNotification: boolean = false): Promise<AudioFileStat> {
    return this.invoke<AudioFileStat>('audio:statAudioFile', { path }, showNotification);
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
