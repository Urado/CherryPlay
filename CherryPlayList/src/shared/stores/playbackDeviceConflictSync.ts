import type { ProjectSessionMode } from '@core/types/project';

import { DEFAULT_PLAYER_WORKSPACE_ID } from '../../core/constants/workspace';

import { useDemoPlayerStore } from './demoPlayerStore';
import { getProjectStore } from './projectStoreFactory';
import { useSettingsStore } from './settingsStore';

/**
 * Demo disable policy: block shared output only in **session** mode when both engines
 * target the same device id (including `null` = system default).
 *
 * In **preparation** mode, main and demo may play simultaneously on the same device
 * so DJs can preview while the main player runs.
 */
export function shouldBlockSharedOutput(
  deviceIdA: string | null,
  deviceIdB: string | null,
  sessionMode: ProjectSessionMode,
): boolean {
  const devicesMatch = deviceIdA === deviceIdB;
  return devicesMatch && sessionMode === 'session';
}

function getSessionMode(): ProjectSessionMode {
  const playerProjectStore = getProjectStore(DEFAULT_PLAYER_WORKSPACE_ID);
  return playerProjectStore?.getState().sessionState?.mode ?? 'preparation';
}

interface SyncConflictParams {
  targetDeviceId: string | null;
  compareDeviceId: string | null;
  targetPlaybackStatus: string;
  pauseTarget: () => void;
  setTargetDisabled: (disabled: boolean) => void;
}

function syncSharedOutputConflict({
  targetDeviceId,
  compareDeviceId,
  targetPlaybackStatus,
  pauseTarget,
  setTargetDisabled,
}: SyncConflictParams): void {
  const mode = getSessionMode();
  const shouldBlock = shouldBlockSharedOutput(targetDeviceId, compareDeviceId, mode);

  if (shouldBlock) {
    if (targetPlaybackStatus === 'playing') {
      pauseTarget();
    }
    setTargetDisabled(true);
    return;
  }

  setTargetDisabled(false);
}

/** Called from demo player when its output device changes or before play. */
export function syncDemoWithMainPlayer(demoDeviceId: string | null): void {
  const playerDeviceId = useSettingsStore.getState().playerAudioDeviceId;
  const demoStore = useDemoPlayerStore.getState();
  syncSharedOutputConflict({
    targetDeviceId: demoDeviceId,
    compareDeviceId: playerDeviceId,
    targetPlaybackStatus: demoStore.status,
    pauseTarget: demoStore.pause,
    setTargetDisabled: demoStore.setDisabled,
  });
}

/** Called from main player when its output device changes or before play. */
export function syncMainWithDemoPlayer(playerDeviceId: string | null): void {
  const demoPlayerDeviceId = useSettingsStore.getState().demoPlayerAudioDeviceId;
  const demoPlayerState = useDemoPlayerStore.getState();
  syncSharedOutputConflict({
    targetDeviceId: playerDeviceId,
    compareDeviceId: demoPlayerDeviceId,
    targetPlaybackStatus: demoPlayerState.status,
    pauseTarget: demoPlayerState.pause,
    setTargetDisabled: demoPlayerState.setDisabled,
  });
}
