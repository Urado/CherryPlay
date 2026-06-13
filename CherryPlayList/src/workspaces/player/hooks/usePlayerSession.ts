import { useCallback } from 'react';

import { Track } from '@core/types/track';
import {
  usePlayerAudioStore,
  useProjectStore,
  useDemoPlayerStore,
  useSettingsStore,
} from '@shared/stores';
import { logger } from '@shared/utils';

interface UsePlayerSessionOptions {
  allTracks: Track[];
  isTrackActive: (trackId: string) => boolean;
  onSessionStart?: () => Promise<void> | void;
  /** Return false to abort session start (e.g. loudness gate cancelled). */
  beforeStartSession?: () => Promise<boolean>;
}

/**
 * Хук для управления сессией (начало/сброс)
 */
export function usePlayerSession(options: UsePlayerSessionOptions) {
  const { allTracks, isTrackActive, onSessionStart, beforeStartSession } = options;

  const { startSession, resetSession, setCurrentTrack } = useProjectStore();
  const {
    loadTrack: loadPlayerTrack,
    play: playPlayer,
    pause: pausePlayer,
    clearPauseTimer,
  } = usePlayerAudioStore();

  const handleStartSession = useCallback(async () => {
    if (allTracks.length === 0) {
      return;
    }

    // Проверяем наличие активных (не отключённых) треков
    const hasActiveTracks = allTracks.some((track) => isTrackActive(track.id));
    if (!hasActiveTracks) {
      return;
    }

    if (beforeStartSession) {
      const canStart = await beforeStartSession();
      if (!canStart) {
        return;
      }
    }

    // Начинаем сессию (локальное воспроизведение; авторизация не требуется)
    startSession();

    // Блокируем демо-плеер, если выбран тот же аудио-выход (включая оба «по умолчанию»)
    const playerDeviceId = useSettingsStore.getState().playerAudioDeviceId;
    const demoDeviceId = useSettingsStore.getState().demoPlayerAudioDeviceId;
    if (playerDeviceId === demoDeviceId) {
      useDemoPlayerStore.getState().setDisabled(true);
    }

    // Вызываем колбэк для начала трансляции, если он предоставлен
    if (onSessionStart) {
      try {
        await onSessionStart();
      } catch (error) {
        logger.error('Failed to start streaming', error);
      }
    }

    // Находим первый активный трек (не проигранный, не отключённый)
    const firstActiveTrack = allTracks.find((track) => isTrackActive(track.id));

    if (firstActiveTrack) {
      try {
        // Загружаем трек в плеер
        await loadPlayerTrack(firstActiveTrack);
        // Устанавливаем его как текущий
        setCurrentTrack(firstActiveTrack.id);
        // Запускаем воспроизведение
        await playPlayer();
      } catch (error) {
        logger.error('Failed to start first track playback', error);
      }
    }
  }, [
    startSession,
    allTracks,
    isTrackActive,
    loadPlayerTrack,
    setCurrentTrack,
    playPlayer,
    onSessionStart,
    beforeStartSession,
  ]);

  const handleResetSession = useCallback(() => {
    clearPauseTimer(); // Очищаем таймер паузы при сбросе
    resetSession();
    pausePlayer(); // Останавливаем плеер при сбросе
    useDemoPlayerStore.getState().setDisabled(false); // Снимаем блокировку демо-плеера
  }, [resetSession, pausePlayer, clearPauseTimer]);

  return {
    handleStartSession,
    handleResetSession,
  };
}
