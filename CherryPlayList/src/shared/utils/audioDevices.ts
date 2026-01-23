/**
 * Утилиты для работы с аудиоустройствами через Web Audio API
 */

export interface AudioDevice {
  deviceId: string;
  label: string;
  kind: MediaDeviceKind;
}

/**
 * Проверяет, поддерживается ли setSinkId в текущем браузере
 */
export function isSinkIdSupported(): boolean {
  return typeof HTMLAudioElement !== 'undefined' && 'setSinkId' in HTMLAudioElement.prototype;
}

/**
 * Получает список всех аудиоустройств вывода
 * @returns Promise с массивом устройств
 */
export async function getAudioOutputDevices(): Promise<AudioDevice[]> {
  if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
    return [];
  }

  try {
    // Для получения полных меток устройств может потребоваться разрешение
    // Попробуем получить разрешение на доступ к микрофону (это разблокирует метки)
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      // Игнорируем ошибку - метки могут быть недоступны, но устройства все равно можно получить
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
}

/**
 * Получает ID устройства по умолчанию
 * @returns 'default' - стандартное значение для устройства по умолчанию
 */
export function getDefaultDeviceId(): string {
  return 'default';
}

/**
 * Проверяет, является ли ошибка ошибкой "устройство не найдено"
 */
function isDeviceNotFoundError(error: unknown): boolean {
  if (error instanceof DOMException) {
    return error.name === 'NotFoundError' || error.message.includes('not found');
  }
  if (error instanceof Error) {
    return error.message.includes('not found') || error.message.includes('NotFoundError');
  }
  return false;
}

/**
 * Применяет выбранное аудиоустройство к HTMLAudioElement
 * @param audioElement - элемент аудио
 * @param deviceId - ID устройства или 'default' для устройства по умолчанию
 * @returns Promise, который разрешается при успешной установке устройства
 * @throws Ошибку только если не удалось установить даже устройство по умолчанию
 */
export async function setAudioSinkId(
  audioElement: HTMLAudioElement,
  deviceId: string | null,
): Promise<void> {
  if (!isSinkIdSupported()) {
    // Если setSinkId не поддерживается, используем устройство по умолчанию
    // В Electron это должно работать, но на всякий случай проверяем
    return;
  }

  const targetDeviceId = deviceId || getDefaultDeviceId();

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (audioElement as any).setSinkId(targetDeviceId);
  } catch (error) {
    // Если это ошибка "устройство не найдено" и мы пытались установить не устройство по умолчанию,
    // пробуем установить устройство по умолчанию
    if (isDeviceNotFoundError(error) && targetDeviceId !== getDefaultDeviceId()) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (audioElement as any).setSinkId(getDefaultDeviceId());
        // Успешно переключились на устройство по умолчанию - не пробрасываем ошибку
        // Вызывающий код должен обновить настройки
        return;
      } catch (fallbackError) {
        // Если даже устройство по умолчанию не удалось установить, логируем и пробрасываем исходную ошибку
        console.error('Failed to set default audio sink ID after device not found', fallbackError);
        throw error;
      }
    }

    // Для других ошибок или если уже пытались установить устройство по умолчанию, логируем и пробрасываем ошибку
    console.error('Failed to set audio sink ID', error);
    throw error;
  }
}
