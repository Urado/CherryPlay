import { getDefaultDeviceId } from '../../utils/audioDevices';
import { logger } from '../../utils/logger';

import type { PlaybackEngine } from './PlaybackEngine';

const isDeviceNotFoundError = (error: unknown): boolean => {
  if (error instanceof DOMException) {
    return error.name === 'NotFoundError' || error.message.includes('not found');
  }
  if (error instanceof Error) {
    return error.message.includes('not found') || error.message.includes('NotFoundError');
  }
  return false;
};

export interface OutputDeviceFallbackOptions {
  readonly deviceId: string | null;
  readonly onDeviceNotFound: () => void;
  readonly logContext: string;
}

export const applyPlaybackOutputDeviceWithFallback = async (
  engine: PlaybackEngine,
  options: OutputDeviceFallbackOptions,
): Promise<void> => {
  const { deviceId, onDeviceNotFound, logContext } = options;

  try {
    await engine.setOutputDevice(deviceId);
  } catch (error) {
    logger.error(`Failed to set audio device (${logContext})`, error);

    if (isDeviceNotFoundError(error) && deviceId !== null) {
      onDeviceNotFound();
      try {
        await engine.setOutputDevice(getDefaultDeviceId());
      } catch (fallbackError) {
        logger.error(`Failed to set default audio device (${logContext})`, fallbackError);
        throw error;
      }
      return;
    }

    throw error;
  }
};
