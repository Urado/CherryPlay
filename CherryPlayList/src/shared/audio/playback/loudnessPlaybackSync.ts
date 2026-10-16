import { isProjectTrack } from '@core/types/project';
import type { Track, TrackLoudness } from '@core/types/track';

import { useDemoPlayerStore } from '../../stores/demoPlayerStore';
import { usePlayerAudioStore } from '../../stores/playerAudioStore';
import { useProjectStore } from '../../stores/projectStore';
import { useSettingsStore } from '../../stores/settingsStore';

import { applyLoudnessPlaybackEffects } from './applyPlaybackEffects';
import type { PlaybackEngine } from './PlaybackEngine';
import { demoPlaybackEngine, mainPlaybackEngine } from './playbackEngines';

const syncPlaybackEngineIfTrackMatches = (
  trackId: string,
  options: {
    currentTrack: Track | null | undefined;
    isPlayerDisabled?: boolean;
    engine: PlaybackEngine;
    onTrackUpdated: (track: Track) => void;
  },
): void => {
  if (options.isPlayerDisabled || !options.currentTrack || options.currentTrack.id !== trackId) {
    return;
  }

  const item = useProjectStore.getState().findItemById(trackId);
  if (!item || !isProjectTrack(item)) {
    return;
  }

  applyLoudnessPlaybackEffects(options.engine, item, useSettingsStore.getState());
  options.onTrackUpdated({ ...item });
};

const syncMainPlayerIfTrackMatches = (trackId: string): void => {
  const { currentTrack } = usePlayerAudioStore.getState();
  syncPlaybackEngineIfTrackMatches(trackId, {
    currentTrack,
    engine: mainPlaybackEngine,
    onTrackUpdated: (track) => usePlayerAudioStore.setState({ currentTrack: track }),
  });
};

const syncDemoPlayerIfTrackMatches = (trackId: string): void => {
  const { currentTrack, isDisabled } = useDemoPlayerStore.getState();
  syncPlaybackEngineIfTrackMatches(trackId, {
    currentTrack,
    isPlayerDisabled: isDisabled,
    engine: demoPlaybackEngine,
    onTrackUpdated: (track) => useDemoPlayerStore.setState({ currentTrack: track }),
  });
};

export const applyLoudnessChangeToActivePlayback = (trackId: string): void => {
  syncMainPlayerIfTrackMatches(trackId);
  syncDemoPlayerIfTrackMatches(trackId);
};

const hasLoudnessPlaybackFieldsChanged = (
  prev: TrackLoudness | undefined,
  next: TrackLoudness | undefined,
): boolean => {
  if (prev === next) {
    return false;
  }
  if (!prev || !next) {
    return prev !== next;
  }

  return (
    prev.status !== next.status ||
    prev.trackGainDb !== next.trackGainDb ||
    prev.manualGainDb !== next.manualGainDb ||
    prev.manualCompressionStrength !== next.manualCompressionStrength ||
    prev.integratedLufs !== next.integratedLufs ||
    prev.lraLowLufs !== next.lraLowLufs ||
    prev.lraLu !== next.lraLu
  );
};

const handleProjectLoudnessChange = (
  state: ReturnType<typeof useProjectStore.getState>,
  prevState: ReturnType<typeof useProjectStore.getState>,
): void => {
  const mainTrackId = usePlayerAudioStore.getState().currentTrack?.id;
  const demoTrackId = useDemoPlayerStore.getState().currentTrack?.id;
  const trackIds = new Set([mainTrackId, demoTrackId].filter(Boolean) as string[]);

  for (const trackId of trackIds) {
    const prevItem = prevState.findItemById(trackId);
    const nextItem = state.findItemById(trackId);
    if (!prevItem || !nextItem || !isProjectTrack(prevItem) || !isProjectTrack(nextItem)) {
      continue;
    }
    if (hasLoudnessPlaybackFieldsChanged(prevItem.loudness, nextItem.loudness)) {
      applyLoudnessChangeToActivePlayback(trackId);
    }
  }
};

export const wireLoudnessPlaybackSync = (): void => {
  useProjectStore.subscribe((state, prevState) => {
    handleProjectLoudnessChange(state, prevState);
  });

  useSettingsStore.subscribe((state, prevState) => {
    if (
      state.loudnessNormalizationEnabled === prevState.loudnessNormalizationEnabled &&
      state.loudnessTargetLufs === prevState.loudnessTargetLufs &&
      state.loudnessCompressionEnabled === prevState.loudnessCompressionEnabled &&
      state.loudnessQuietGapRangeLu === prevState.loudnessQuietGapRangeLu
    ) {
      return;
    }

    const mainTrackId = usePlayerAudioStore.getState().currentTrack?.id;
    const demoTrackId = useDemoPlayerStore.getState().currentTrack?.id;
    if (mainTrackId) {
      syncMainPlayerIfTrackMatches(mainTrackId);
    }
    if (demoTrackId) {
      syncDemoPlayerIfTrackMatches(demoTrackId);
    }
  });
};
