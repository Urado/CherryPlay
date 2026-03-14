import type { AimpBridgeState } from '../contracts/aimp';

import { canStartAimpLiveStream } from './aimpStreamingAdapter';
import { logger } from './logger';

export interface AimpOrganizerSessionActions {
  startSession: () => Promise<void>;
  setLiveStreamStarted: (liveStreamStarted: boolean) => Promise<void>;
  endSession: () => Promise<void>;
  resetPlaybackState: () => Promise<void>;
  disconnect?: () => Promise<void>;
}

interface StartAimpOrganizerSessionOptions {
  bridgeState: Pick<
    AimpBridgeState,
    | 'sourceSelection'
    | 'environment'
    | 'connection'
    | 'pluginMetadata'
    | 'playlistSnapshot'
    | 'playbackSnapshot'
  >;
  publishingBridgeReady: boolean;
  actions: AimpOrganizerSessionActions;
}

interface TeardownAimpOrganizerSessionOptions {
  actions: AimpOrganizerSessionActions;
  shouldEndSession: boolean;
  shouldResetPlaybackState: boolean;
  shouldDisconnect: boolean;
}

export async function startAimpOrganizerSession({
  bridgeState,
  publishingBridgeReady,
  actions,
}: StartAimpOrganizerSessionOptions): Promise<void> {
  if (!publishingBridgeReady) {
    throw new Error('AIMP publishing path is not ready yet.');
  }

  if (!canStartAimpLiveStream(bridgeState)) {
    throw new Error('AIMP snapshots and plugin connection are not ready for live streaming yet.');
  }

  await actions.startSession();

  try {
    await actions.setLiveStreamStarted(true);
  } catch (error) {
    await teardownAimpOrganizerSession({
      actions,
      shouldEndSession: true,
      shouldResetPlaybackState: true,
      shouldDisconnect: false,
    });
    throw error;
  }
}

export async function teardownAimpOrganizerSession({
  actions,
  shouldEndSession,
  shouldResetPlaybackState,
  shouldDisconnect,
}: TeardownAimpOrganizerSessionOptions): Promise<void> {
  if (shouldEndSession) {
    try {
      await actions.endSession();
    } catch (error) {
      logger.error('[AIMP] Failed to end organizer session during teardown', error);
    }
  }

  if (shouldResetPlaybackState) {
    try {
      await actions.resetPlaybackState();
    } catch (error) {
      logger.error('[AIMP] Failed to reset organizer playback state during teardown', error);
    }
  }

  if (shouldDisconnect && actions.disconnect) {
    try {
      await actions.disconnect();
    } catch (error) {
      logger.error('[AIMP] Failed to disconnect SignalR during teardown', error);
    }
  }
}
