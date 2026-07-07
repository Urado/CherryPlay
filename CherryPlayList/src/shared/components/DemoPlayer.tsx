import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import VolumeDownIcon from '@mui/icons-material/VolumeDown';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import React, { useCallback, useEffect, useMemo } from 'react';
import { shallow } from 'zustand/shallow';

import { Track } from '../../core/types/track';
import { usePlaybackTimeline } from '../hooks/usePlaybackTimeline';
import { useDemoPlayerStore } from '../stores/demoPlayerStore';
import type { PlayerStatus } from '../stores/demoPlayerStore';
import { useUIStore } from '../stores/uiStore';
import { formatPlayerTime } from '../utils/durationUtils';

type NotificationType = 'success' | 'error' | 'info';

interface NotificationPayload {
  type: NotificationType;
  message: string;
}

export interface DemoPlayerController {
  currentTrack: Track | null;
  status: PlayerStatus;
  position: number;
  duration: number;
  volume: number;
  error: string | null;
  isDisabled?: boolean;
  play: () => Promise<void>;
  pause: () => void;
  seek: (positionSeconds: number) => void;
  setVolume: (value: number) => void;
  clear: () => void;
}

export const useDemoPlayerController = (): DemoPlayerController =>
  useDemoPlayerStore(
    (state) => ({
      currentTrack: state.currentTrack,
      status: state.status,
      position: state.position,
      duration: state.duration,
      volume: state.volume,
      error: state.error,
      play: state.play,
      pause: state.pause,
      seek: state.seek,
      setVolume: state.setVolume,
      clear: state.clear,
      isDisabled: state.isDisabled,
    }),
    shallow,
  );

interface DemoPlayerProps {
  className?: string;
  onShowInBrowser?: (path: string) => void;
  controller?: DemoPlayerController;
  notify?: (payload: NotificationPayload) => void;
  /** When false, unmount does not call clear() — used by DemoPlayerShell on dock/undock. Default: true. */
  clearOnUnmount?: boolean;
  /** Blocks all controls (e.g. layout edit mode) without changing store disabled state. */
  interactionBlocked?: boolean;
}

const isSafeTrackPath = (path: string | null | undefined): boolean => {
  if (!path || typeof path !== 'string') {
    return false;
  }

  const trimmed = path.trim();
  if (!trimmed || trimmed.includes('\n') || trimmed.includes('\r')) {
    return false;
  }

  if (trimmed.includes('://') && !trimmed.startsWith('file://')) {
    return false;
  }

  const isAbsoluteWindowsPath = /^[a-zA-Z]:[\\/]/.test(trimmed);
  const isUNCPath = trimmed.startsWith('\\\\');
  const isUnixPath = trimmed.startsWith('/') || trimmed.startsWith('file://');

  return isAbsoluteWindowsPath || isUNCPath || isUnixPath;
};

export const DemoPlayer: React.FC<DemoPlayerProps> = ({
  className,
  onShowInBrowser,
  controller,
  notify,
  clearOnUnmount = true,
  interactionBlocked = false,
}) => {
  const storeNotification = useUIStore((state) => state.addNotification);
  const addNotification = notify ?? storeNotification;
  const storeController = useDemoPlayerController();
  const player = controller ?? storeController;
  const {
    currentTrack,
    status,
    position,
    duration,
    volume,
    error,
    isDisabled: storeIsDisabled,
    play,
    pause,
    seek,
    setVolume,
    clear,
  } = player;
  const isPlaying = status === 'playing';
  const playbackBlocked = storeIsDisabled || !currentTrack || Boolean(error);
  const isDisabled = interactionBlocked || playbackBlocked;
  const resolvedDuration =
    (Number.isFinite(duration) && duration > 0 ? duration : currentTrack?.duration) ?? 0;
  const timeline = usePlaybackTimeline({
    position,
    duration: resolvedDuration,
    disabled: isDisabled,
    seek,
    onSeekCommitted: () => {
      if (status === 'ended' && currentTrack) {
        void play();
      }
    },
  });

  useEffect(() => {
    if (!clearOnUnmount) {
      return undefined;
    }
    return () => {
      clear();
    };
  }, [clear, clearOnUnmount]);

  const handleToggle = useCallback(async () => {
    if (!currentTrack) {
      return;
    }
    if (isPlaying) {
      pause();
      return;
    }

    try {
      await play();
    } catch {
      const existingError = controller ? error : useDemoPlayerStore.getState().error;
      if (!existingError) {
        addNotification({
          type: 'error',
          message: 'Не удалось начать воспроизведение. Проверьте настройки аудио.',
        });
      }
    }
  }, [addNotification, controller, currentTrack, error, isPlaying, pause, play]);

  const handleVolumeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(event.target.value);
    if (Number.isFinite(value)) {
      setVolume(value);
    }
  };

  const handleShowInBrowser = () => {
    if (!currentTrack || !onShowInBrowser) {
      return;
    }
    if (!isSafeTrackPath(currentTrack.path)) {
      addNotification({
        type: 'error',
        message: 'Путь к файлу выглядит небезопасным, действие отменено.',
      });
      return;
    }
    onShowInBrowser(currentTrack.path);
  };

  const containerClassName = useMemo(
    () =>
      [
        'demo-player',
        className,
        isDisabled ? 'demo-player--disabled' : null,
        storeIsDisabled ? 'demo-player--blocked' : null,
        interactionBlocked ? 'demo-player--interaction-blocked' : null,
      ]
        .filter(Boolean)
        .join(' '),
    [className, interactionBlocked, isDisabled, storeIsDisabled],
  );

  return (
    <div className={containerClassName}>
      <div className="demo-player__info-row">
        <div className="demo-player__info">
          <div className="demo-player__title">{currentTrack?.name ?? 'Нет активного трека'}</div>
          {error ? <div className="demo-player__error">{error}</div> : null}
          {storeIsDisabled && !error ? (
            <div className="demo-player__warning">
              Заблокирован: используется то же устройство, что и плеер
            </div>
          ) : null}
        </div>
      </div>

      <div className="demo-player__controls-row">
        <button
          type="button"
          className="demo-player__icon-button"
          onClick={handleToggle}
          disabled={isDisabled}
          title={
            storeIsDisabled
              ? 'Прослушивание файла недоступно (то же устройство, что у плеера)'
              : isPlaying
                ? 'Пауза'
                : 'Воспроизвести'
          }
          aria-label={isPlaying ? 'Пауза' : 'Воспроизвести'}
        >
          {isPlaying ? <PauseIcon fontSize="small" /> : <PlayArrowIcon fontSize="small" />}
        </button>
        <span className="demo-player__time">{formatPlayerTime(timeline.displayPosition)}</span>
        <input
          type="range"
          min={0}
          max={timeline.resolvedDuration}
          step={0.1}
          value={playbackBlocked ? 0 : timeline.displayPosition}
          onPointerDown={timeline.beginScrub}
          onInput={timeline.handleInput}
          onChange={timeline.handleChange}
          disabled={isDisabled}
          className="demo-player__timeline"
          aria-label="Позиция воспроизведения демо-трека"
          aria-valuemin={0}
          aria-valuemax={timeline.resolvedDuration}
          aria-valuenow={timeline.displayPosition}
        />
        <span className="demo-player__time demo-player__time--total">
          {formatPlayerTime(resolvedDuration)}
        </span>
        <div className="demo-player__volume">
          <VolumeDownIcon fontSize="small" />
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={handleVolumeChange}
            disabled={isDisabled}
            className="demo-player__volume-slider"
            aria-label="Громкость демо-плеера"
            aria-valuemin={0}
            aria-valuemax={1}
            aria-valuenow={volume}
          />
          <VolumeUpIcon fontSize="small" />
        </div>
        <button
          type="button"
          className="demo-player__show-button"
          onClick={handleShowInBrowser}
          disabled={isDisabled || !currentTrack || !onShowInBrowser}
          title="Показать файл в проводнике"
          aria-label="Показать файл в проводнике"
        >
          <FolderOpenIcon fontSize="small" />
        </button>
      </div>
    </div>
  );
};
