import { useCallback, useEffect, useRef } from 'react';

import { DEFAULT_PLAYER_WORKSPACE_ID } from '@core/constants/workspace';
import { Track } from '@core/types/track';
import { usePlayerAudioStore, useProjectStore } from '@shared/stores';
import { logger } from '@shared/utils';

import { usePlayerMode } from './usePlayerMode';

interface UsePlayerPlaybackOptions {
  allTracks: Track[];
  getEffectiveTrackSettings: (trackId: string) => {
    actionAfterTrack: string;
    pauseBetweenTracks: number;
  };
  getNextActiveTrack: () => Track | null;
  markTrackAsPlayed: (trackId: string) => void;
  markSkippedDisabledTracks: (fromIndex: number, toIndex: number) => void;
  setCurrentTrack: (trackId: string | null) => void;
}

/**
 * Хук для управления воспроизведением треков
 * Объединяет логику для режимов preparation и session
 */
export function usePlayerPlayback(options: UsePlayerPlaybackOptions) {
  const {
    allTracks,
    getEffectiveTrackSettings,
    getNextActiveTrack,
    markTrackAsPlayed,
    markSkippedDisabledTracks,
    setCurrentTrack,
  } = options;

  const mode = useProjectStore((state) => state.sessionState.mode);
  const isPreparationMode = mode === 'preparation';

  const playerMode = usePlayerMode();

  // Для режима сессии нужны дополнительные функции из playerAudioStore
  const {
    currentTrack: activePlayerTrack,
    status: playerAudioStatus,
    loadTrack: loadPlayerTrack,
    play: playPlayer,
    setOnTrackEnded,
    setPauseTimer,
    clearPauseTimer,
    stop,
  } = usePlayerAudioStore();

  const activePlayerTrackId = activePlayerTrack?.id;

  // Флаг для предотвращения race condition при обработке окончания трека
  const isProcessingTrackEndRef = useRef(false);

  // Используем ref для хранения актуальных значений для callback
  const playerStateRef = useRef({
    status: playerAudioStatus,
    currentTrackId: activePlayerTrackId,
  });

  // Обновляем ref при изменении состояния
  useEffect(() => {
    playerStateRef.current = {
      status: playerAudioStatus,
      currentTrackId: activePlayerTrackId,
    };
  }, [playerAudioStatus, activePlayerTrackId]);

  /**
   * Запускает воспроизведение трека
   */
  const startTrackPlayback = useCallback(
    async (track: Track) => {
      try {
        if (isPreparationMode) {
          // В режиме подготовки используем демо-плеер
          const isSameTrack = playerMode.currentTrack?.id === track.id;
          if (!isSameTrack || playerMode.status === 'ended') {
            // Для демо-плеера нужен workspaceId
            await playerMode.loadTrack(track, DEFAULT_PLAYER_WORKSPACE_ID);
          }
          await playerMode.play();
        } else {
          // В режиме сессии используем playerAudioStore
          const isSameTrack = activePlayerTrackId === track.id;
          if (!isSameTrack || playerAudioStatus === 'ended') {
            await loadPlayerTrack(track);
          }
          await playPlayer();
        }
      } catch (error) {
        logger.error('Failed to start track playback', error);
      }
    },
    [
      isPreparationMode,
      playerMode,
      activePlayerTrackId,
      playerAudioStatus,
      loadPlayerTrack,
      playPlayer,
    ],
  );

  /**
   * Ставит воспроизведение на паузу
   */
  const pausePlayback = useCallback(() => {
    playerMode.pause();
  }, [playerMode]);

  /**
   * Обработчик окончания трека
   * Исправлена проблема с getState() - используем ref для актуальных значений
   */
  const handleTrackEnded = useCallback(async () => {
    if (!activePlayerTrackId || isPreparationMode) {
      return;
    }

    // Предотвращаем race condition - если уже обрабатываем окончание, игнорируем
    if (isProcessingTrackEndRef.current) {
      return;
    }

    isProcessingTrackEndRef.current = true;

    try {
      const currentTrack = allTracks.find((t) => t.id === activePlayerTrackId);
      if (!currentTrack) {
        return;
      }

      const currentIndex = allTracks.findIndex((t) => t.id === activePlayerTrackId);

      // Помечаем текущий трек как проигранный
      markTrackAsPlayed(activePlayerTrackId);

      // Получаем настройки для текущего трека
      const settings = getEffectiveTrackSettings(activePlayerTrackId);

      // Применяем действие после трека
      if (settings.actionAfterTrack === 'pause') {
        // Пауза после трека - переходим к следующему и ставим на паузу
        const nextTrack = getNextActiveTrack();
        if (nextTrack) {
          const nextIndex = allTracks.findIndex((t) => t.id === nextTrack.id);
          markSkippedDisabledTracks(currentIndex, nextIndex);
          await loadPlayerTrack(nextTrack);
          setCurrentTrack(nextTrack.id);
          // Трек уже на паузе после загрузки
        } else {
          markSkippedDisabledTracks(currentIndex, allTracks.length);
          setCurrentTrack(null);
        }
      } else if (settings.actionAfterTrack === 'pauseAndNext') {
        // Пауза между треками - ждем время паузы, затем переходим
        const nextTrack = getNextActiveTrack();
        if (nextTrack) {
          const nextIndex = allTracks.findIndex((t) => t.id === nextTrack.id);
          markSkippedDisabledTracks(currentIndex, nextIndex);
          await loadPlayerTrack(nextTrack);
          setCurrentTrack(nextTrack.id);
          // Запускаем таймер паузы через store
          // Исправлено: используем ref для актуальных значений вместо getState()
          setPauseTimer(async () => {
            const currentState = playerStateRef.current;
            // Проверяем, что трек все еще тот же и все еще на паузе
            if (currentState.status === 'paused' && currentState.currentTrackId === nextTrack.id) {
              await playPlayer();
            }
          }, settings.pauseBetweenTracks * 1000);
        } else {
          markSkippedDisabledTracks(currentIndex, allTracks.length);
          setCurrentTrack(null);
        }
      } else {
        // Сплошное воспроизведение (next) - сразу переходим к следующему
        const nextTrack = getNextActiveTrack();
        if (nextTrack) {
          const nextIndex = allTracks.findIndex((t) => t.id === nextTrack.id);
          markSkippedDisabledTracks(currentIndex, nextIndex);
          await loadPlayerTrack(nextTrack);
          setCurrentTrack(nextTrack.id);
          await playPlayer();
        } else {
          markSkippedDisabledTracks(currentIndex, allTracks.length);
          setCurrentTrack(null);
        }
      }
    } finally {
      isProcessingTrackEndRef.current = false;
    }
  }, [
    activePlayerTrackId,
    isPreparationMode,
    allTracks,
    markTrackAsPlayed,
    getEffectiveTrackSettings,
    getNextActiveTrack,
    loadPlayerTrack,
    setCurrentTrack,
    playPlayer,
    markSkippedDisabledTracks,
    setPauseTimer,
  ]);

  /**
   * Обработчик Next
   */
  const handleNext = useCallback(async () => {
    if (isPreparationMode || !activePlayerTrackId) {
      return;
    }

    // Очищаем таймер паузы при ручном переходе
    clearPauseTimer();

    // Предотвращаем race condition
    if (isProcessingTrackEndRef.current) {
      return;
    }

    isProcessingTrackEndRef.current = true;

    try {
      const currentIndex = allTracks.findIndex((t) => t.id === activePlayerTrackId);
      markTrackAsPlayed(activePlayerTrackId);
      const nextTrack = getNextActiveTrack();
      if (nextTrack) {
        const nextIndex = allTracks.findIndex((t) => t.id === nextTrack.id);
        markSkippedDisabledTracks(currentIndex, nextIndex);
        await loadPlayerTrack(nextTrack);
        setCurrentTrack(nextTrack.id);
        await playPlayer();
      } else {
        markSkippedDisabledTracks(currentIndex, allTracks.length);
        stop();
        setCurrentTrack(null);
      }
    } finally {
      isProcessingTrackEndRef.current = false;
    }
  }, [
    isPreparationMode,
    activePlayerTrackId,
    allTracks,
    markTrackAsPlayed,
    getNextActiveTrack,
    markSkippedDisabledTracks,
    loadPlayerTrack,
    setCurrentTrack,
    playPlayer,
    stop,
    clearPauseTimer,
  ]);

  // Устанавливаем обработчик окончания трека
  useEffect(() => {
    if (!isPreparationMode) {
      setOnTrackEnded(handleTrackEnded);
    } else {
      setOnTrackEnded(undefined);
    }
    return () => {
      setOnTrackEnded(undefined);
    };
  }, [isPreparationMode, handleTrackEnded, setOnTrackEnded]);

  return {
    startTrackPlayback,
    pausePlayback,
    handleNext,
    activeTrackId: isPreparationMode ? playerMode.currentTrack?.id : activePlayerTrackId,
    playerStatus: isPreparationMode ? playerMode.status : playerAudioStatus,
  };
}
