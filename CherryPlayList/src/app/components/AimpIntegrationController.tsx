import React, { useCallback, useEffect, useRef, useState } from 'react';

import { partyService, signalRService } from '@shared/services';
import {
  useAimpStore,
  useDemoPlayerStore,
  usePlayerAudioStore,
  useProjectStore,
  useSettingsStore,
  useUIStore,
} from '@shared/stores';
import {
  canAdvanceAimpPlayback,
  canStartAimpLiveStream,
  convertAimpPlaylistForApi,
  createAimpPlaybackStateDto,
  formatAimpPublishingPathError,
  getAimpAvailability,
  teardownAimpOrganizerSession,
  getAimpPlaybackPublishKey,
  getAimpPlaylistPublishKey,
  logger,
  startAimpPublishingBridge,
} from '@shared/utils';

export const AimpIntegrationController: React.FC = () => {
  const initialize = useAimpStore((state) => state.initialize);
  const syncSourceSelection = useAimpStore((state) => state.syncSourceSelection);
  const bridgeState = useAimpStore((state) => state.bridgeState);
  const setPublishingPathState = useAimpStore((state) => state.setPublishingPathState);

  const hasHydrated = useSettingsStore((state) => state._hasHydrated);
  const enableStreaming = useSettingsStore((state) => state.enableStreaming);
  const streamingSource = useSettingsStore((state) => state.streamingSource);
  const setStreamingSource = useSettingsStore((state) => state.setStreamingSource);

  const linkedPartyId = useProjectStore((state) => state.meta.linkedParty?.id ?? null);
  const partyTrackDisplay = useProjectStore((state) => state.meta.partyTrackDisplay);
  const addNotification = useUIStore((state) => state.addNotification);

  const [signalRReady, setSignalRReady] = useState(false);
  const previousStreamingSourceRef = useRef<typeof streamingSource | null>(null);
  const liveSessionActiveRef = useRef(false);
  const publishedPlaylistKeyRef = useRef<string | null>(null);
  const publishedPlaybackKeyRef = useRef<string | null>(null);
  const positionUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const teardownPromiseRef = useRef<Promise<void> | null>(null);

  const stopAimpPositionUpdates = useCallback(() => {
    if (positionUpdateIntervalRef.current) {
      clearInterval(positionUpdateIntervalRef.current);
      positionUpdateIntervalRef.current = null;
    }
  }, []);

  const teardownStreamingBridge = useCallback(
    async (shouldDisconnect: boolean) => {
      if (teardownPromiseRef.current) {
        return teardownPromiseRef.current;
      }

      const hadLiveSession = liveSessionActiveRef.current || bridgeState.liveStreamStarted;
      const shouldResetPlaybackState =
        hadLiveSession ||
        publishedPlaylistKeyRef.current !== null ||
        publishedPlaybackKeyRef.current !== null;

      stopAimpPositionUpdates();
      liveSessionActiveRef.current = false;
      publishedPlaylistKeyRef.current = null;
      publishedPlaybackKeyRef.current = null;
      const teardownPromise = teardownAimpOrganizerSession({
        actions: {
          startSession: async () => undefined,
          setLiveStreamStarted: async () => undefined,
          endSession: async () => {
            if (linkedPartyId && signalRService.isServiceConnected() && hadLiveSession) {
              await signalRService.endSession(linkedPartyId);
            }
          },
          resetPlaybackState: async () => {
            if (linkedPartyId && signalRService.isServiceConnected() && shouldResetPlaybackState) {
              await signalRService.resetPlaybackState(linkedPartyId);
            }
          },
          disconnect: shouldDisconnect
            ? async () => {
                if (signalRService.isServiceConnected()) {
                  await signalRService.disconnect();
                }
              }
            : undefined,
        },
        shouldEndSession: hadLiveSession,
        shouldResetPlaybackState,
        shouldDisconnect,
      }).finally(() => {
        teardownPromiseRef.current = null;
      });

      teardownPromiseRef.current = teardownPromise;
      return teardownPromise;
    },
    [bridgeState.liveStreamStarted, linkedPartyId, stopAimpPositionUpdates],
  );

  useEffect(() => {
    initialize().catch((error) => {
      logger.error('[AIMP] Failed to bootstrap renderer integration', error);
    });
  }, [initialize]);

  useEffect(() => {
    if (!hasHydrated) {
      return;
    }

    let cancelled = false;

    const syncSource = async () => {
      try {
        const nextState = await syncSourceSelection(streamingSource);
        const availability = getAimpAvailability(nextState);

        if (!cancelled && streamingSource === 'aimp' && !availability.available) {
          setStreamingSource('cherryPlayPlayer');
          addNotification({
            type: 'warning',
            message:
              availability.gatingReasons[0]?.message ??
              'AIMP источник недоступен. Возвращаемся к CherryPlay Player.',
            duration: 6000,
          });
        }
      } catch (error) {
        logger.error('[AIMP] Failed to sync renderer source selection', error);
      }
    };

    syncSource();

    return () => {
      cancelled = true;
    };
  }, [addNotification, hasHydrated, setStreamingSource, streamingSource, syncSourceSelection]);

  useEffect(() => {
    if (!hasHydrated) {
      return;
    }

    const previousSource = previousStreamingSourceRef.current;
    previousStreamingSourceRef.current = streamingSource;

    publishedPlaylistKeyRef.current = null;
    publishedPlaybackKeyRef.current = null;

    if (streamingSource !== 'aimp') {
      stopAimpPositionUpdates();
      setPublishingPathState('idle');
      return;
    }

    if (previousSource === 'aimp') {
      return;
    }

    useProjectStore.getState().resetSession();
    usePlayerAudioStore.getState().clear();
    useDemoPlayerStore.getState().clear();
    signalRService.stopStoreSubscriptions();
    signalRService.stopPositionUpdates();

    if (linkedPartyId && signalRService.isServiceConnected()) {
      signalRService.endSession(linkedPartyId).catch((error) => {
        logger.error('[AIMP] Failed to end previous player-backed session', error);
      });
      signalRService.resetPlaybackState(linkedPartyId).catch((error) => {
        logger.error('[AIMP] Failed to reset previous player-backed playback state', error);
      });
    }
  }, [
    hasHydrated,
    linkedPartyId,
    setPublishingPathState,
    stopAimpPositionUpdates,
    streamingSource,
  ]);

  useEffect(() => {
    if (!(hasHydrated && enableStreaming && linkedPartyId && streamingSource === 'aimp')) {
      queueMicrotask(() => {
        setSignalRReady(false);
        setPublishingPathState('idle');
      });
      void teardownStreamingBridge(true);
      return;
    }

    let cancelled = false;

    const connectSignalR = async () => {
      try {
        if (!cancelled) {
          setPublishingPathState('connecting');
        }

        const publishingBridgeState = await startAimpPublishingBridge(linkedPartyId, {
          checkPartyExists: (partyId) => partyService.checkPartyExists(partyId),
          connect: () => signalRService.connect(),
          joinPartyAsOrganizer: (partyId) => signalRService.joinPartyAsOrganizer(partyId),
        });

        if (cancelled) {
          return;
        }

        if (publishingBridgeState.status !== 'ready') {
          setSignalRReady(false);
          setPublishingPathState(publishingBridgeState.status, publishingBridgeState.error);
          return;
        }

        setSignalRReady(true);
        setPublishingPathState('ready');
      } catch (error) {
        logger.error('[AIMP] Failed to connect renderer AIMP streaming to SignalR', error);
        if (!cancelled) {
          setSignalRReady(false);
          setPublishingPathState('error', formatAimpPublishingPathError('connect', error));
        }
      }
    };

    connectSignalR();

    return () => {
      cancelled = true;
    };
  }, [
    enableStreaming,
    hasHydrated,
    linkedPartyId,
    setPublishingPathState,
    streamingSource,
    teardownStreamingBridge,
  ]);

  const canPublishLiveState =
    signalRReady &&
    enableStreaming &&
    streamingSource === 'aimp' &&
    linkedPartyId !== null &&
    bridgeState.liveStreamStarted &&
    canStartAimpLiveStream(bridgeState);

  useEffect(() => {
    if (!linkedPartyId || streamingSource !== 'aimp' || !signalRReady) {
      return;
    }

    if (!bridgeState.liveStreamStarted) {
      stopAimpPositionUpdates();
      publishedPlaylistKeyRef.current = null;
      publishedPlaybackKeyRef.current = null;

      if (liveSessionActiveRef.current) {
        void teardownAimpOrganizerSession({
          actions: {
            startSession: async () => undefined,
            setLiveStreamStarted: async () => undefined,
            endSession: async () => {
              await signalRService.endSession(linkedPartyId);
            },
            resetPlaybackState: async () => {
              await signalRService.resetPlaybackState(linkedPartyId);
            },
          },
          shouldEndSession: true,
          shouldResetPlaybackState: true,
          shouldDisconnect: false,
        });
        liveSessionActiveRef.current = false;
      }
      return;
    }

    if (!canPublishLiveState) {
      stopAimpPositionUpdates();

      if (
        liveSessionActiveRef.current &&
        bridgeState.playlistSnapshot !== null &&
        bridgeState.playbackSnapshot !== null
      ) {
        const frozenState = createAimpPlaybackStateDto(
          bridgeState,
          Date.parse(bridgeState.playbackSnapshot.receivedAt),
        );
        void signalRService
          .notifyStateChangedOrThrow(linkedPartyId)
          .then(() => signalRService.updateFullStateOrThrow(linkedPartyId, frozenState))
          .catch((error) => {
            logger.error('[AIMP] Failed to publish frozen AIMP state', error);
            setPublishingPathState(
              'error',
              formatAimpPublishingPathError('fullStatePublish', error),
            );
          });
      }

      return;
    }

    if (!liveSessionActiveRef.current) {
      liveSessionActiveRef.current = true;
    }
  }, [
    bridgeState,
    canPublishLiveState,
    linkedPartyId,
    signalRReady,
    setPublishingPathState,
    stopAimpPositionUpdates,
    streamingSource,
  ]);

  useEffect(() => {
    if (!linkedPartyId || !canPublishLiveState) {
      return;
    }

    let cancelled = false;

    const publishLatestState = async () => {
      let cycleError: string | null = null;

      const playlistPublishKey = getAimpPlaylistPublishKey(bridgeState.playlistSnapshot);
      if (playlistPublishKey !== null && publishedPlaylistKeyRef.current !== playlistPublishKey) {
        try {
          await partyService.updatePartyPlaylist(
            linkedPartyId,
            convertAimpPlaylistForApi(bridgeState.playlistSnapshot, partyTrackDisplay),
          );
          publishedPlaylistKeyRef.current = playlistPublishKey;
        } catch (error) {
          logger.error('[AIMP] Failed to publish playlist snapshot', error);
          cycleError = formatAimpPublishingPathError('playlistPublish', error);
        }
      }

      const playbackPublishKey = getAimpPlaybackPublishKey(bridgeState);
      if (publishedPlaybackKeyRef.current !== playbackPublishKey) {
        try {
          const playbackState = createAimpPlaybackStateDto(bridgeState);
          await signalRService.notifyStateChangedOrThrow(linkedPartyId);
          await signalRService.updateFullStateOrThrow(linkedPartyId, playbackState);
          publishedPlaybackKeyRef.current = playbackPublishKey;
        } catch (error) {
          logger.error('[AIMP] Failed to publish AIMP playback state', error);
          cycleError = cycleError ?? formatAimpPublishingPathError('fullStatePublish', error);
        }
      }

      if (!cancelled) {
        if (cycleError) {
          setPublishingPathState('error', cycleError);
        } else {
          setPublishingPathState('ready');
        }
      }
    };

    void publishLatestState();

    return () => {
      cancelled = true;
    };
  }, [bridgeState, canPublishLiveState, linkedPartyId, partyTrackDisplay, setPublishingPathState]);

  useEffect(() => {
    stopAimpPositionUpdates();

    if (
      !linkedPartyId ||
      !canPublishLiveState ||
      !canAdvanceAimpPlayback(bridgeState.connection.phase, bridgeState.playbackSnapshot?.status)
    ) {
      return;
    }

    const sendPosition = () => {
      const playbackState = createAimpPlaybackStateDto(bridgeState);
      if (!playbackState.currentTrackId) {
        return;
      }

      signalRService.updatePlaybackPosition(
        linkedPartyId,
        playbackState.currentTrackId,
        playbackState.position,
      );
    };

    sendPosition();
    positionUpdateIntervalRef.current = setInterval(sendPosition, 1000);

    return () => {
      stopAimpPositionUpdates();
    };
  }, [
    bridgeState,
    bridgeState.connection.phase,
    bridgeState.playbackSnapshot?.currentTrackKey,
    bridgeState.playbackSnapshot?.positionMs,
    bridgeState.playbackSnapshot?.receivedAt,
    bridgeState.playbackSnapshot?.status,
    canPublishLiveState,
    linkedPartyId,
    stopAimpPositionUpdates,
  ]);

  useEffect(() => {
    return () => {
      stopAimpPositionUpdates();
      setPublishingPathState('idle');
    };
  }, [setPublishingPathState, stopAimpPositionUpdates]);

  return null;
};
