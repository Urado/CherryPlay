import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import VolumeDownIcon from '@mui/icons-material/VolumeDown';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import React, { useCallback, useMemo } from 'react';
import { shallow } from 'zustand/shallow';

import { useCherryPlayStreamingConnection } from '@app/components/CherryPlayStreamingController';
import { isProjectTrack } from '@core/types/project';
import { StreamingConnectionIndicator } from '@shared/components';
import { usePlayerAudioStore, useProjectStore, useSettingsStore } from '@shared/stores';
import { formatPlayerTime } from '@shared/utils/durationUtils';
import { PARTY_EDITOR_LIFECYCLE_BADGE_LABELS } from '@workspaces/party/partyEditorPhase';
import { usePartyWorkspaceStore } from '@workspaces/party/partyWorkspaceStore';

interface HeaderPlaybackPillProps {
  disabled?: boolean;
}

export const HeaderPlaybackPill: React.FC<HeaderPlaybackPillProps> = ({ disabled = false }) => {
  const enableStreaming = useSettingsStore((state) => state.enableStreaming);
  const streamingSource = useSettingsStore((state) => state.streamingSource);
  const linkedParty = useProjectStore((state) => state.meta?.linkedParty ?? null);
  const sessionMode = useProjectStore((state) => state.sessionState.mode);
  const sessionCurrentTrackId = useProjectStore((state) => state.sessionState.currentTrackId);
  const partyLifecycleState = usePartyWorkspaceStore((state) => state.partyLifecycleState);

  const { connectionState, reconnect } = useCherryPlayStreamingConnection();

  const { currentTrack, status, position, duration, volume, error, play, pause, setVolume } =
    usePlayerAudioStore(
      (state) => ({
        currentTrack: state.currentTrack,
        status: state.status,
        position: state.position,
        duration: state.duration,
        volume: state.volume,
        error: state.error,
        play: state.play,
        pause: state.pause,
        setVolume: state.setVolume,
      }),
      shallow,
    );

  const resolveTrackById = useProjectStore((state) => state.findItemById);

  const trackLabel = useMemo(() => {
    if (currentTrack?.name) {
      return currentTrack.name;
    }
    if (sessionCurrentTrackId) {
      const item = resolveTrackById(sessionCurrentTrackId);
      if (item && isProjectTrack(item)) {
        return item.name;
      }
    }
    return 'Нет активного трека';
  }, [currentTrack?.name, resolveTrackById, sessionCurrentTrackId]);

  const partyStatusLabel = useMemo(() => {
    if (!linkedParty) {
      return 'Вечеринка не привязана';
    }
    if (partyLifecycleState) {
      return PARTY_EDITOR_LIFECYCLE_BADGE_LABELS[partyLifecycleState];
    }
    return `Вечеринка ${linkedParty.shortCode}`;
  }, [linkedParty, partyLifecycleState]);

  const isSessionMode = sessionMode === 'session';
  const isVisible = enableStreaming && streamingSource === 'cherryPlayPlayer';

  const isPlaying = status === 'playing';
  const canToggle = currentTrack !== null && !disabled;
  const resolvedDuration = duration || currentTrack?.duration || 0;
  const showTimeline = resolvedDuration > 0 && currentTrack !== null;

  const handleToggle = useCallback(async () => {
    if (!canToggle) {
      return;
    }

    if (isPlaying) {
      pause();
    } else {
      try {
        await play();
      } catch {
        // store handles error state
      }
    }
  }, [canToggle, isPlaying, pause, play]);

  const handleVolumeChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setVolume(parseFloat(event.target.value));
    },
    [setVolume],
  );

  if (!isVisible) {
    return null;
  }

  const onlineIndicator = (
    <StreamingConnectionIndicator
      connectionState={linkedParty ? connectionState : null}
      onReconnect={reconnect}
      className="playback-pill__online"
      compact
    />
  );

  return (
    <div
      className={[
        'playback-pill',
        disabled ? 'playback-pill--blocked' : '',
        isSessionMode ? '' : 'playback-pill--prep',
      ]
        .filter(Boolean)
        .join(' ')}
      role="group"
      aria-label="Вечеринка и проигрывание"
    >
      <span className="playback-pill__party-status" title={partyStatusLabel}>
        {partyStatusLabel}
      </span>

      {isSessionMode ? (
        <>
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
            {isPlaying ? <PauseIcon fontSize="small" /> : <PlayArrowIcon fontSize="small" />}
          </button>

          <div className="playback-pill__track" title={trackLabel}>
            <span className="playback-pill__track-name">{trackLabel}</span>
            {showTimeline ? (
              <span className="playback-pill__track-time">
                {formatPlayerTime(position)} / {formatPlayerTime(resolvedDuration)}
              </span>
            ) : null}
            {error ? <span className="playback-pill__track-error">{error}</span> : null}
          </div>

          <div className="playback-pill__volume">
            <VolumeDownIcon fontSize="small" aria-hidden />
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={handleVolumeChange}
              className="playback-pill__volume-slider"
              disabled={disabled}
              title={`Громкость: ${Math.round(volume * 100)}%`}
              aria-label="Громкость"
            />
            <VolumeUpIcon fontSize="small" aria-hidden />
          </div>

          {onlineIndicator}
        </>
      ) : (
        <>
          <span className="playback-pill__prep-label">Проигрывание не запущено</span>
          {onlineIndicator}
        </>
      )}
    </div>
  );
};
