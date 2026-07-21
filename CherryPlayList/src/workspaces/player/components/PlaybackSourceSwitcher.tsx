import { Button } from '@cherryplay/components';
import React, { useCallback, useMemo } from 'react';

import { usePlatformCapabilities } from '@shared/platform';
import { useAimpStore, useSettingsStore } from '@shared/stores';
import { getAimpAvailability } from '@shared/utils';

type PlaybackSource = 'cherryPlayPlayer' | 'aimp';

const SOURCE_LABELS: Record<PlaybackSource, string> = {
  cherryPlayPlayer: 'CherryPlay',
  aimp: 'AIMP',
};

const ALTERNATE_SOURCE: Record<PlaybackSource, { id: PlaybackSource; label: string }> = {
  cherryPlayPlayer: { id: 'aimp', label: SOURCE_LABELS.aimp },
  aimp: { id: 'cherryPlayPlayer', label: SOURCE_LABELS.cherryPlayPlayer },
};

interface PlaybackSourceSwitcherProps {
  disabled?: boolean;
  /**
   * `inline` — muted link after stats text (legacy inline placement).
   * `topRow` — slim dedicated strip above stats (Player + AIMP embedded headers).
   */
  layout?: 'inline' | 'topRow';
}

export const PlaybackSourceSwitcher: React.FC<PlaybackSourceSwitcherProps> = ({
  disabled = false,
  layout,
}) => {
  const streamingSource = useSettingsStore((state) => state.streamingSource);
  const setStreamingSource = useSettingsStore((state) => state.setStreamingSource);
  const bridgeState = useAimpStore((state) => state.bridgeState);
  const { supportsAimpWorkspace } = usePlatformCapabilities();

  const aimpAvailability = getAimpAvailability(bridgeState);
  const canSelectAimp = supportsAimpWorkspace && aimpAvailability.available;

  const alternate = useMemo(() => ALTERNATE_SOURCE[streamingSource], [streamingSource]);
  const currentLabel = SOURCE_LABELS[streamingSource];
  const switchTooltip = `Нажмите, чтобы переключить на ${alternate.label}`;

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

  const layoutClass =
    layout === 'inline'
      ? ' playback-source-switch--inline'
      : layout === 'topRow'
        ? ' playback-source-switch--top-row'
        : '';

  const buttonLabel = layout === 'topRow' ? `Источник: ${currentLabel}` : alternate.label;
  const ariaLabel =
    layout === 'topRow'
      ? `Источник: ${currentLabel}. ${switchTooltip}`
      : `Источник воспроизведения: ${switchTooltip}`;

  const button = (
    <Button
      type="button"
      className={`playback-source-switch${layoutClass}`}
      disabled={disabled}
      title={switchTooltip}
      aria-label={ariaLabel}
      onClick={handleSwitch}
      variant="ghost"
      size="sm"
    >
      {buttonLabel}
    </Button>
  );

  if (layout === 'inline') {
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
