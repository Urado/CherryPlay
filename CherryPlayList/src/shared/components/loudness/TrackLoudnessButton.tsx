import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import GraphicEqIcon from '@mui/icons-material/GraphicEq';
import React from 'react';

import type { Track } from '@core/types/track';
import { getEffectiveGainDb } from '@shared/audio/loudnessGain';
import {
  getEffectiveCompressionStrength,
  resolveAutoCompressionStrength,
} from '@shared/audio/playback/compressionStrength';
import { useSettingsStore } from '@shared/stores/settingsStore';
import { formatGainDb } from '@shared/utils/formatGainDb';

import { Spinner } from '../Spinner';

import { isCompressionOverridden, isGainOverridden } from './loudnessOverrides';
import {
  getTrackLoudnessVisualState,
  LOUDNESS_METRIC_LABEL_COMPRESSION,
  LOUDNESS_METRIC_LABEL_GAIN,
} from './TrackLoudnessPopover';

interface TrackLoudnessButtonProps {
  track: Track;
  isOpen?: boolean;
  buttonRef?: React.RefObject<HTMLButtonElement | null>;
  onClick: (anchorRect: DOMRect) => void;
}

export const TrackLoudnessButton: React.FC<TrackLoudnessButtonProps> = ({
  track,
  isOpen = false,
  buttonRef,
  onClick,
}) => {
  const loudnessSettings = useSettingsStore((state) => ({
    loudnessNormalizationEnabled: state.loudnessNormalizationEnabled,
    loudnessTargetLufs: state.loudnessTargetLufs,
    loudnessCompressionEnabled: state.loudnessCompressionEnabled,
    loudnessQuietGapRangeLu: state.loudnessQuietGapRangeLu,
  }));
  const visualState = getTrackLoudnessVisualState(track.loudness);
  const autoGainDb = track.loudness?.status === 'ok' ? track.loudness.trackGainDb : undefined;
  const effectiveGainDb = getEffectiveGainDb(track);
  const autoCompressionStrength =
    track.loudness?.status === 'ok' ? resolveAutoCompressionStrength(track, loudnessSettings) : 0;
  const compressionStrength =
    track.loudness?.status === 'ok' ? getEffectiveCompressionStrength(track, loudnessSettings) : 0;
  const isGainCustom = isGainOverridden(effectiveGainDb, autoGainDb);
  const isCompressionCustom = isCompressionOverridden(compressionStrength, autoCompressionStrength);
  const showGainMetric = effectiveGainDb !== undefined;
  const showCompressionMetric = loudnessSettings.loudnessCompressionEnabled && visualState === 'ok';
  const showMetrics = showGainMetric || showCompressionMetric;

  const titleParts: string[] = [];
  if (showGainMetric) {
    titleParts.push(
      `${LOUDNESS_METRIC_LABEL_GAIN}: ${formatGainDb(effectiveGainDb)} dB${isGainCustom ? ' (ручная)' : ''}`,
    );
  }
  if (showCompressionMetric) {
    titleParts.push(
      `${LOUDNESS_METRIC_LABEL_COMPRESSION}: ${Math.round(compressionStrength * 100)}%${isCompressionCustom ? ' (ручная)' : ''}`,
    );
  }
  const title =
    titleParts.length > 0
      ? titleParts.join(' · ')
      : visualState === 'pending'
        ? 'Сканирование громкости…'
        : visualState === 'error'
          ? 'Ошибка анализа громкости'
          : 'Громкость не проанализирована';

  return (
    <button
      ref={buttonRef}
      type="button"
      className={`track-loudness-button track-loudness-button--${visualState}${
        isOpen ? ' track-loudness-button--open' : ''
      }${showMetrics ? ' track-loudness-button--has-metrics' : ''}`}
      title={title}
      aria-label={title}
      aria-expanded={isOpen}
      onPointerDown={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        onClick((event.currentTarget as HTMLElement).getBoundingClientRect());
      }}
    >
      {visualState === 'pending' ? (
        <Spinner size="small" />
      ) : showMetrics ? (
        <span className="track-loudness-button__metrics">
          {showGainMetric && (
            <span
              className={`track-loudness-button__metric${isGainCustom ? ' track-loudness-button__metric--custom' : ''}`}
            >
              <span className="track-loudness-button__metric-label">
                {LOUDNESS_METRIC_LABEL_GAIN}
              </span>
              <span className="track-loudness-button__metric-value">
                {formatGainDb(effectiveGainDb)}
              </span>
            </span>
          )}
          {showCompressionMetric && (
            <span
              className={`track-loudness-button__metric${isCompressionCustom ? ' track-loudness-button__metric--custom' : ''}`}
            >
              <span className="track-loudness-button__metric-label">
                {LOUDNESS_METRIC_LABEL_COMPRESSION}
              </span>
              <span className="track-loudness-button__metric-value">
                {Math.round(compressionStrength * 100)}%
              </span>
            </span>
          )}
        </span>
      ) : visualState === 'error' ? (
        <ErrorOutlineIcon style={{ fontSize: 'var(--font-size-secondary)' }} />
      ) : (
        <GraphicEqIcon style={{ fontSize: 'var(--font-size-secondary)' }} />
      )}
    </button>
  );
};
