import { stopDemoLiveMockPlayback } from '../demo/demoLiveMockPlayback';
import { useDemoPlayerStore } from '../stores/demoPlayerStore';
import { usePlayerAudioStore } from '../stores/playerAudioStore';

export interface NewProjectSessionGuardOptions {
  sessionActive: boolean;
  confirmSessionStop: () => boolean;
  stopLocally: () => void;
  stopServerSession: () => Promise<void>;
  resetProject: () => void;
  onServerStopFailure: (error: unknown) => void;
}

export const stopLocalPlayerSession = (): void => {
  const playerAudio = usePlayerAudioStore.getState();
  playerAudio.clearPauseTimer();
  stopDemoLiveMockPlayback();
  playerAudio.pause();
  useDemoPlayerStore.getState().setDisabled(false);
};

export const runNewProjectWithSessionGuard = async ({
  sessionActive,
  confirmSessionStop,
  stopLocally,
  stopServerSession,
  resetProject,
  onServerStopFailure,
}: NewProjectSessionGuardOptions): Promise<boolean> => {
  if (sessionActive && !confirmSessionStop()) {
    return false;
  }

  if (sessionActive) {
    stopLocally();
    try {
      await stopServerSession();
    } catch (error) {
      onServerStopFailure(error);
      return false;
    }
  }

  resetProject();
  return true;
};
