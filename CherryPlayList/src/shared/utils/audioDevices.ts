export interface AudioDevice {
  deviceId: string;
  label: string;
  kind: MediaDeviceKind;
}

export const isSinkIdSupported = (): boolean => {
  return typeof HTMLAudioElement !== 'undefined' && 'setSinkId' in HTMLAudioElement.prototype;
};

export const getAudioOutputDevices = async (): Promise<AudioDevice[]> => {
  if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
    return [];
  }

  try {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      void 0;
    }

    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioOutputDevices = devices
      .filter((device) => device.kind === 'audiooutput')
      .map((device) => ({
        deviceId: device.deviceId,
        label: device.label || `Устройство ${device.deviceId.substring(0, 8)}`,
        kind: device.kind,
      }));

    return audioOutputDevices;
  } catch (error) {
    console.error('Failed to enumerate audio devices', error);
    return [];
  }
};

export const getDefaultDeviceId = (): string => {
  return 'default';
};

const isDeviceNotFoundError = (error: unknown): boolean => {
  if (error instanceof DOMException) {
    return error.name === 'NotFoundError' || error.message.includes('not found');
  }
  if (error instanceof Error) {
    return error.message.includes('not found') || error.message.includes('NotFoundError');
  }
  return false;
};

export const setAudioSinkId = async (
  audioElement: HTMLAudioElement,
  deviceId: string | null,
): Promise<void> => {
  if (!isSinkIdSupported()) {
    return;
  }

  const targetDeviceId = deviceId || getDefaultDeviceId();

  try {
    await (
      audioElement as HTMLAudioElement & { setSinkId: (id: string) => Promise<void> }
    ).setSinkId(targetDeviceId);
  } catch (error) {
    if (isDeviceNotFoundError(error) && targetDeviceId !== getDefaultDeviceId()) {
      try {
        await (
          audioElement as HTMLAudioElement & { setSinkId: (id: string) => Promise<void> }
        ).setSinkId(getDefaultDeviceId());
        return;
      } catch (fallbackError) {
        console.error('Failed to set default audio sink ID after device not found', fallbackError);
        throw error;
      }
    }

    console.error('Failed to set audio sink ID', error);
    throw error;
  }
};
