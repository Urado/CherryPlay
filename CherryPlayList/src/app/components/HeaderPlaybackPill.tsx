import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import React, { useCallback } from 'react';
import { shallow } from 'zustand/shallow';

import { useCherryPlayStreamingConnection } from '@app/components/CherryPlayStreamingController';
import { StreamingConnectionIndicator } from '@shared/components';
import { usePlayerAudioStore, useProjectStore, useSettingsStore } from '@shared/stores';
import { useOnlineNetworkPolicy } from '@shared/streaming';
import { formatPlayerTime } from '@shared/utils/durationUtils';
import { togglePlayPause } from '@shared/utils/togglePlayPause';

interface HeaderPlaybackPillProps {
  disabled?: boolean;
}

export const HeaderPlaybackPill: React.FC<HeaderPlaybackPillProps> = ({ disabled = false }) => {
  const streamingSource = useSettingsStore((state) => state.streamingSource);
  const linkedParty = useProjectStore((state) => state.meta?.linkedParty ?? null);
  const sessionMode = useProjectStore((state) => state.sessionState.mode);
  const { networkEnabled } = useOnlineNetworkPolicy();

  const { connectionState, reconnect } = useCherryPlayStreamingConnection();

  const { currentTrack, status, position, duration, error, play, pause } = usePlayerAudioStore(
    (state) => ({
      currentTrack: state.currentTrack,
      status: state.status,
      position: state.position,
      duration: state.duration,
      error: state.error,
      play: state.play,
      pause: state.pause,
    }),
    shallow,
  );

  const isVisible = sessionMode === 'session' && streamingSource === 'cherryPlayPlayer';

  const trackLabel = currentTrack?.name ?? 'Нет активного трека';
  const isPlaying = status === 'playing';
  const canToggle = currentTrack !== null && !disabled;
  const resolvedDuration = duration || currentTrack?.duration || 0;
  const showTimeline = resolvedDuration > 0 && currentTrack !== null;

  const handleToggle = useCallback(() => {
    void togglePlayPause({
      hasTrack: currentTrack !== null,
      isPlaying,
      blocked: !canToggle,
      play,
      pause,
    });
  }, [canToggle, currentTrack, isPlaying, pause, play]);

  if (!isVisible) {
    return null;
  }

  return (
    <div
      className={['playback-pill', disabled ? 'playback-pill--blocked' : '']
        .filter(Boolean)
        .join(' ')}
      role="group"
      aria-label="Вечеринка и проигрывание"
    >
      <button
        type="button"
        className="playback-pill__toggle"
        onClick={() => {
          void handleToggle();
        }}
        disabled={!canToggle}
        title={error ? error : isPlaying ? 'Пауза' : canToggle ? 'Воспроизвести' : 'Нет трека'}
        aria-label={isPlaying ? 'Пауза' : 'Воспроизвести'}
      >
        <span className="playback-pill__icon-box" aria-hidden>
          {isPlaying ? <PauseIcon fontSize="inherit" /> : <PlayArrowIcon fontSize="inherit" />}
        </span>
      </button>

      <div className="playback-pill__main">
        <div className="playback-pill__track" title={trackLabel}>
          <span className="playback-pill__track-name">{trackLabel}</span>
          <span
            className={[
              'playback-pill__track-time',
              showTimeline ? '' : 'playback-pill__track-time--placeholder',
            ]
              .filter(Boolean)
              .join(' ')}
            aria-hidden={!showTimeline}
          >
            {showTimeline
              ? `${formatPlayerTime(position)} / ${formatPlayerTime(resolvedDuration)}`
              : '\u00a0'}
          </span>
        </div>
      </div>

      {linkedParty ? (
        <StreamingConnectionIndicator
          connectionState={connectionState}
          onReconnect={networkEnabled ? reconnect : undefined}
          hasLinkedParty
          className="playback-pill__online"
          compact
        />
      ) : null}
    </div>
  );
};
