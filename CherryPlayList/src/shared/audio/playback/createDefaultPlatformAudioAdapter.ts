import { ipcService } from '../../services/ipcService';
import { setAudioSinkId } from '../../utils/audioDevices';

import type { PlatformAudioAdapter, ResolvedPlaybackUrl } from './PlatformAudioAdapter';
import type { PlaybackSource } from './types';

export const createDefaultPlatformAudioAdapter = (): PlatformAudioAdapter => {
  return {
    async resolveSource(source: PlaybackSource): Promise<ResolvedPlaybackUrl> {
      switch (source.kind) {
        case 'filePath': {
          const { url } = await ipcService.getAudioFileUrl(source.path, false);
          return { url };
        }
        case 'url':
          return { url: source.url };
        case 'blobUrl':
          return { url: source.blobUrl };
        default: {
          const exhaustiveCheck: never = source;
          throw new Error(
            `Unknown playback source kind: ${(exhaustiveCheck as PlaybackSource).kind}`,
          );
        }
      }
    },

    async getDuration(filePath: string): Promise<number | null> {
      try {
        const duration = await ipcService.getAudioDuration(filePath, false);
        return Number.isFinite(duration) ? duration : null;
      } catch {
        return null;
      }
    },

    async analyzeLoudness(filePath: string, targetLufs: number) {
      try {
        return await ipcService.analyzeLoudness(filePath, targetLufs, false);
      } catch {
        return null;
      }
    },

    async statAudioFile(filePath: string) {
      try {
        return await ipcService.statAudioFile(filePath, false);
      } catch {
        return null;
      }
    },

    async setSinkId(
      target: HTMLAudioElement | AudioContext,
      deviceId: string | null,
    ): Promise<void> {
      if (target instanceof HTMLAudioElement) {
        await setAudioSinkId(target, deviceId);
        return;
      }

      const targetWithSinkId = target as AudioContext & { setSinkId?: (sinkId: string) => Promise<void> };
      if (typeof targetWithSinkId.setSinkId === 'function') {
        const sinkId = deviceId ?? 'default';
        await targetWithSinkId.setSinkId(sinkId);
      }
    },
  };
};
