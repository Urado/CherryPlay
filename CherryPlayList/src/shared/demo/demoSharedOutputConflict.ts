import { useUIStore } from '../stores/uiStore';

export const DEMO_SHARED_OUTPUT_CONFLICT_MESSAGE =
  'Предпрослушивание недоступно — тот же аудиовыход, что у основного плеера.';

export const DEMO_SHARED_OUTPUT_CONFLICT_ACTION_LABEL = 'Выбрать другое устройство';

export const DEMO_PLAYER_AUDIO_DEVICE_SETTINGS_ELEMENT_ID = 'demo-player-audio-device';

export const isDemoSharedOutputConflictError = (error: string | null | undefined): boolean => {
  if (!error) {
    return false;
  }
  return (
    error === DEMO_SHARED_OUTPUT_CONFLICT_MESSAGE ||
    error === 'Воспроизведение невозможно: используется то же устройство, что и плеер'
  );
};

export const openDemoAudioDeviceSettings = (): void => {
  useUIStore
    .getState()
    .openSettingsModal(DEMO_PLAYER_AUDIO_DEVICE_SETTINGS_ELEMENT_ID);
};
