import { ipcService } from '../../services/ipcService';
import { setAudioSinkId } from '../../utils/audioDevices';

import type { PlatformAudioAdapter, ResolvedPlaybackUrl } from './PlatformAudioAdapter';
import type { PlaybackSource } from './types';

/**
 * Default Electron/browser {@link PlatformAudioAdapter} delegating to IPC and audio device helpers.
 *
 * Resolves `filePath` via `audio:getFileUrl` → `cherryplay-audio://` streaming protocol URL.
 * Protocol URLs work under the renderer CSP without base64/Blob indirection.
 */
export function createDefaultPlatformAudioAdapter(): PlatformAudioAdapter {
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

    async setSinkId(
      target: HTMLAudioElement | AudioContext,
      deviceId: string | null,
    ): Promise<void> {
      if (target instanceof HTMLAudioElement) {
        await setAudioSinkId(target, deviceId);
        return;
      }

      if ('setSinkId' in target && typeof target.setSinkId === 'function') {
        const sinkId = deviceId ?? 'default';
        await target.setSinkId(sinkId);
      }
    },
  };
}
