import { usePlayerAudioStore, useProjectStore, useUIStore } from '@shared/stores';

export const DEMO_PLAY_FAILURE_MESSAGE =
  'Не удалось начать воспроизведение. Проверьте настройки аудио.';

export interface TogglePlayPauseParams {
  hasTrack: boolean;
  isPlaying: boolean;
  blocked?: boolean;
  play: () => Promise<void>;
  pause: () => void;
  onPlayFailure?: () => void;
}

export async function togglePlayPause(params: TogglePlayPauseParams): Promise<void> {
  if (params.blocked || !params.hasTrack) {
    return;
  }

  if (params.isPlaying) {
    params.pause();
    return;
  }

  try {
    await params.play();
  } catch {
    params.onPlayFailure?.();
  }
}

export function notifyDemoPlayFailureIfNeeded(existingError: string | null | undefined): void {
  if (existingError) {
    return;
  }
  useUIStore.getState().addNotification({
    type: 'error',
    message: DEMO_PLAY_FAILURE_MESSAGE,
  });
}

export function toggleSessionPlayPause(): void {
  const mode = useProjectStore.getState().sessionState.mode;
  if (mode !== 'session') {
    return;
  }

  const { currentTrack, status, play, pause } = usePlayerAudioStore.getState();
  void togglePlayPause({
    hasTrack: currentTrack !== null,
    isPlaying: status === 'playing',
    play,
    pause,
  });
}
