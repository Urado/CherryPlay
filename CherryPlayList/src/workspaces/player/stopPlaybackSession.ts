export interface StopPlaybackSessionActions {
  shouldResetServer: boolean;
  stopLocally: () => void;
  resetServerPlaybackState: () => Promise<void>;
  publishFullState: () => void;
  onServerResetFailure: (error: unknown) => void;
}

export const stopPlaybackSession = async ({
  shouldResetServer,
  stopLocally,
  resetServerPlaybackState,
  publishFullState,
  onServerResetFailure,
}: StopPlaybackSessionActions): Promise<void> => {
  stopLocally();
  if (!shouldResetServer) return;

  try {
    await resetServerPlaybackState();
  } catch (error) {
    onServerResetFailure(error);
    return;
  }

  publishFullState();
};
