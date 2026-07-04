import React, { useCallback, useMemo } from 'react';

import { usePlatformCapabilities } from '@shared/platform';
import { useAimpStore, useSettingsStore } from '@shared/stores';
import { getAimpAvailability } from '@shared/utils';

type PlaybackSource = 'cherryPlayPlayer' | 'aimp';

const ALTERNATE_SOURCE: Record<PlaybackSource, { id: PlaybackSource; label: string }> = {
  cherryPlayPlayer: { id: 'aimp', label: 'AIMP' },
  aimp: { id: 'cherryPlayPlayer', label: 'CherryPlay' },
};

interface PlaybackSourceSwitcherProps {
  disabled?: boolean;
  /** Renders as a muted inline link after stats text (no extra row). */
  inline?: boolean;
}

export const PlaybackSourceSwitcher: React.FC<PlaybackSourceSwitcherProps> = ({
  disabled = false,
  inline = false,
}) => {
  const streamingSource = useSettingsStore((state) => state.streamingSource);
  const setStreamingSource = useSettingsStore((state) => state.setStreamingSource);
  const bridgeState = useAimpStore((state) => state.bridgeState);
  const { supportsAimpWorkspace } = usePlatformCapabilities();

  const aimpAvailability = getAimpAvailability(bridgeState);
  const canSelectAimp = supportsAimpWorkspace && aimpAvailability.available;

  const alternate = useMemo(() => ALTERNATE_SOURCE[streamingSource], [streamingSource]);

  const handleSwitch = useCallback(() => {
    if (disabled) {
      return;
    }
    if (alternate.id === 'aimp' && !canSelectAimp) {
      return;
    }
    setStreamingSource(alternate.id);
  }, [alternate.id, canSelectAimp, disabled, setStreamingSource]);

  if (!supportsAimpWorkspace) {
    return null;
  }

  if (alternate.id === 'aimp' && !canSelectAimp) {
    return null;
  }

  const button = (
    <button
      type="button"
      className={`playback-source-switch${inline ? ' playback-source-switch--inline' : ''}`}
      disabled={disabled}
      title={`Переключить на ${alternate.label}`}
      aria-label={`Источник воспроизведения: переключить на ${alternate.label}`}
      onClick={handleSwitch}
    >
      {alternate.label}
    </button>
  );

  if (inline) {
    return (
      <span className="playlist-stats-header__switch">
        <span className="playlist-stats-header__sep" aria-hidden>
          •
        </span>
        {button}
      </span>
    );
  }

  return button;
};
