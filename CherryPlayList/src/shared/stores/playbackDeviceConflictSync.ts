import type { ProjectSessionMode } from '@core/types/project';

import { DEFAULT_PLAYER_WORKSPACE_ID } from '../../core/constants/workspace';

import { useDemoPlayerStore } from './demoPlayerStore';
import { usePlayerAudioStore } from './playerAudioStore';
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

/** Called from demo player when its output device changes or before play. */
export function syncDemoWithMainPlayer(demoDeviceId: string | null): void {
  const playerDeviceId = useSettingsStore.getState().playerAudioDeviceId;
  const playerState = usePlayerAudioStore.getState();
  const mode = getSessionMode();
  const shouldBlock = shouldBlockSharedOutput(demoDeviceId, playerDeviceId, mode);

  const demoStore = useDemoPlayerStore.getState();
  if (shouldBlock) {
    if (playerState.status === 'playing') {
      demoStore.pause();
    }
    demoStore.setDisabled(true);
  } else {
    demoStore.setDisabled(false);
  }
}

/** Called from main player when its output device changes or before play. */
export function syncMainWithDemoPlayer(playerDeviceId: string | null): void {
  const demoPlayerDeviceId = useSettingsStore.getState().demoPlayerAudioDeviceId;
  const demoPlayerState = useDemoPlayerStore.getState();
  const mode = getSessionMode();
  const shouldBlock = shouldBlockSharedOutput(playerDeviceId, demoPlayerDeviceId, mode);

  if (shouldBlock) {
    if (demoPlayerState.status === 'playing') {
      demoPlayerState.pause();
    }
    demoPlayerState.setDisabled(true);
  } else {
    demoPlayerState.setDisabled(false);
  }
}
