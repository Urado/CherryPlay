import { isProjectTrack } from '@core/types/project';
import type { Track, TrackLoudness } from '@core/types/track';

import { useDemoPlayerStore } from '../../stores/demoPlayerStore';
import { usePlayerAudioStore } from '../../stores/playerAudioStore';
import { useProjectStore } from '../../stores/projectStore';
import { useSettingsStore } from '../../stores/settingsStore';

import { applyLoudnessPlaybackEffects } from './applyPlaybackEffects';
import type { PlaybackEngine } from './PlaybackEngine';
import { demoPlaybackEngine, mainPlaybackEngine } from './playbackEngines';

function syncPlaybackEngineIfTrackMatches(
  trackId: string,
  options: {
    currentTrack: Track | null | undefined;
    isPlayerDisabled?: boolean;
    engine: PlaybackEngine;
    onTrackUpdated: (track: Track) => void;
  },
): void {
  if (options.isPlayerDisabled || !options.currentTrack || options.currentTrack.id !== trackId) {
    return;
  }

  const item = useProjectStore.getState().findItemById(trackId);
  if (!item || !isProjectTrack(item)) {
    return;
  }

  applyLoudnessPlaybackEffects(options.engine, item, useSettingsStore.getState());
  options.onTrackUpdated({ ...item });
}

function syncMainPlayerIfTrackMatches(trackId: string): void {
  const { currentTrack } = usePlayerAudioStore.getState();
  syncPlaybackEngineIfTrackMatches(trackId, {
    currentTrack,
    engine: mainPlaybackEngine,
    onTrackUpdated: (track) => usePlayerAudioStore.setState({ currentTrack: track }),
  });
}

function syncDemoPlayerIfTrackMatches(trackId: string): void {
  const { currentTrack, isDisabled } = useDemoPlayerStore.getState();
  syncPlaybackEngineIfTrackMatches(trackId, {
    currentTrack,
    isPlayerDisabled: isDisabled,
    engine: demoPlaybackEngine,
    onTrackUpdated: (track) => useDemoPlayerStore.setState({ currentTrack: track }),
  });
}

/** Re-apply loudness gain on active engines when a track's loudness metadata changes. */
export function applyLoudnessChangeToActivePlayback(trackId: string): void {
  syncMainPlayerIfTrackMatches(trackId);
  syncDemoPlayerIfTrackMatches(trackId);
}

function hasLoudnessPlaybackFieldsChanged(
  prev: TrackLoudness | undefined,
  next: TrackLoudness | undefined,
): boolean {
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
}

function handleProjectLoudnessChange(
  state: ReturnType<typeof useProjectStore.getState>,
  prevState: ReturnType<typeof useProjectStore.getState>,
): void {
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
}

/** Subscribe to project/settings updates so gain changes apply during playback. */
export function wireLoudnessPlaybackSync(): void {
  useProjectStore.subscribe((state, prevState) => {
    handleProjectLoudnessChange(state, prevState);
  });

  useSettingsStore.subscribe((state, prevState) => {
    if (
      state.loudnessNormalizationEnabled === prevState.loudnessNormalizationEnabled &&
      state.loudnessTargetLufs === prevState.loudnessTargetLufs &&
      state.loudnessCompressionEnabled === prevState.loudnessCompressionEnabled
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
}
