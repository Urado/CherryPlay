import React, { useCallback, useMemo, useRef, useState } from 'react';

import { isProjectTrack } from '@core/types/project';
import type { Track } from '@core/types/track';
import { applyLoudnessChangeToActivePlayback } from '@shared/audio/playback/loudnessPlaybackSync';
import { getPlatformCapabilities } from '@shared/platform';
import { loudnessService } from '@shared/services';
import { useProjectStore, useSettingsStore } from '@shared/stores';

import { TrackLoudnessButton } from './TrackLoudnessButton';
import { TrackLoudnessPopover } from './TrackLoudnessPopover';

interface TrackLoudnessRowControlsProps {
  track: Track;
}

export const TrackLoudnessRowControls: React.FC<TrackLoudnessRowControlsProps> = ({ track }) => {
  const loudnessNormalizationEnabled = useSettingsStore(
    (state) => state.loudnessNormalizationEnabled,
  );
  const updateTrackManualGain = useProjectStore((state) => state.updateTrackManualGain);
  const updateTrackManualCompression = useProjectStore(
    (state) => state.updateTrackManualCompression,
  );
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);

  const supportsLoudness = useMemo(() => {
    try {
      return getPlatformCapabilities().supportsLoudnessAnalysis;
    } catch {
      return false;
    }
  }, []);

  const freshTrack = useProjectStore((state) => {
    const item = state.findItemById(track.id);
    return item && isProjectTrack(item) ? item : track;
  });

  const handleButtonClick = useCallback(
    (rect: DOMRect) => {
      if (isOpen) {
        setIsOpen(false);
        setAnchorRect(null);
        return;
      }
      setAnchorRect(rect);
      setIsOpen(true);
    },
    [isOpen],
  );

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setAnchorRect(null);
  }, []);

  const handleScan = useCallback(() => {
    void loudnessService.scanTrack(freshTrack);
    handleClose();
  }, [freshTrack, handleClose]);

  const handleManualGainChange = useCallback(
    (manualGainDb: number | undefined) => {
      updateTrackManualGain(freshTrack.id, manualGainDb);
      applyLoudnessChangeToActivePlayback(freshTrack.id);
    },
    [freshTrack.id, updateTrackManualGain],
  );

  const handleManualCompressionChange = useCallback(
    (manualCompressionStrength: number | undefined) => {
      updateTrackManualCompression(freshTrack.id, manualCompressionStrength);
      applyLoudnessChangeToActivePlayback(freshTrack.id);
    },
    [freshTrack.id, updateTrackManualCompression],
  );

  if (!loudnessNormalizationEnabled || !supportsLoudness) {
    return null;
  }

  return (
    <>
      <TrackLoudnessButton
        track={freshTrack}
        isOpen={isOpen}
        buttonRef={buttonRef}
        onClick={handleButtonClick}
      />
      {isOpen && anchorRect && (
        <TrackLoudnessPopover
          track={freshTrack}
          anchorRect={anchorRect}
          anchorRef={buttonRef}
          canScan={supportsLoudness}
          onClose={handleClose}
          onScan={handleScan}
          onManualGainChange={handleManualGainChange}
          onManualCompressionChange={handleManualCompressionChange}
        />
      )}
    </>
  );
};
