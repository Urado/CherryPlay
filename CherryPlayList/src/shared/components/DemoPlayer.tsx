import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import VolumeDownIcon from '@mui/icons-material/VolumeDown';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { shallow } from 'zustand/shallow';

import { Track } from '../../core/types/track';
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
  const lastErrorRef = useRef<string | null>(null);

  const isPlaying = status === 'playing';
  const isDisabled = storeIsDisabled || !currentTrack || Boolean(error);
  const resolvedDuration =
    (Number.isFinite(duration) && duration > 0 ? duration : currentTrack?.duration) ??
    (isDisabled ? 0 : 1);
  const safePosition = Number.isFinite(position) ? Math.min(position, resolvedDuration) : 0;

  useEffect(() => {
    return () => {
      clear();
    };
  }, [clear]);

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
      addNotification({
        type: 'error',
        message: 'Не удалось начать воспроизведение. Проверьте настройки аудио.',
      });
    }
  }, [addNotification, currentTrack, isPlaying, pause, play]);

  const handleSeek = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(event.target.value);
    if (Number.isFinite(value)) {
      seek(value);
      if (status === 'ended' && currentTrack) {
        void play();
      }
    }
  };

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

  useEffect(() => {
    if (error && lastErrorRef.current !== error) {
      lastErrorRef.current = error;
      addNotification({ type: 'error', message: error });
    }

    if (!error) {
      lastErrorRef.current = null;
    }
  }, [error, addNotification]);

  const containerClassName = useMemo(
    () =>
      [
        'demo-player',
        className,
        isDisabled ? 'demo-player--disabled' : null,
        storeIsDisabled ? 'demo-player--blocked' : null,
      ]
        .filter(Boolean)
        .join(' '),
    [className, isDisabled, storeIsDisabled],
  );

  return (
    <div className={containerClassName}>
      <div className="demo-player__info-row">
        <button
          type="button"
          className="demo-player__icon-button"
          onClick={handleToggle}
          disabled={isDisabled}
          title={
            storeIsDisabled
              ? 'Демо-плеер заблокирован (используется то же устройство, что и плеер)'
              : isPlaying
                ? 'Пауза'
                : 'Воспроизвести'
          }
        >
          {isPlaying ? <PauseIcon fontSize="medium" /> : <PlayArrowIcon fontSize="medium" />}
        </button>
        <div className="demo-player__info">
          <div className="demo-player__title">{currentTrack?.name ?? 'Нет активного трека'}</div>
          {error ? <div className="demo-player__error">{error}</div> : null}
          {storeIsDisabled && !error ? (
            <div className="demo-player__warning">
              Заблокирован: используется то же устройство, что и плеер
            </div>
          ) : null}
        </div>
        <button
          type="button"
          className="demo-player__show-button"
          onClick={handleShowInBrowser}
          disabled={!currentTrack || !onShowInBrowser}
        >
          <OpenInNewIcon fontSize="small" />
          <span>Показать в браузере</span>
        </button>
      </div>

      <div className="demo-player__controls-row">
        <span className="demo-player__time">{formatPlayerTime(safePosition)}</span>
        <input
          type="range"
          min={0}
          max={resolvedDuration || 1}
          step={0.1}
          value={isDisabled ? 0 : safePosition}
          onChange={handleSeek}
          disabled={isDisabled}
          className="demo-player__timeline"
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
            className="demo-player__volume-slider"
          />
          <VolumeUpIcon fontSize="small" />
        </div>
      </div>
    </div>
  );
};
