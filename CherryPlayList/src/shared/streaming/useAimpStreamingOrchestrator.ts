import * as signalR from '@microsoft/signalr';
import { useEffect, useRef } from 'react';

import { useSettingsStore } from '../stores';
import { useAimpStore } from '../stores/aimpStore';
import { formatAimpPublishingPathError } from '../utils/aimpPublishingPath';

import { AimpBroadcastSource } from './AimpBroadcastSource';
import { isStreamingNetworkEnabled } from './onlineNetworkPolicy';
import { streamingOrchestrator } from './streamingOrchestrator';

export interface UseAimpStreamingOrchestratorOptions {
  partyId: string | null;
  hasHydrated: boolean;
  onPartyNotFound?: () => void;
}

/**
 * React hook for AIMP Site Streamer lifecycle.
 * Active only when network policy allows and `streamingSource === 'aimp'`.
 */
export function useAimpStreamingOrchestrator(options: UseAimpStreamingOrchestratorOptions): void {
  const { partyId, hasHydrated, onPartyNotFound } = options;
  const enableStreaming = useSettingsStore((state) => state.enableStreaming);
  const streamingSource = useSettingsStore((state) => state.streamingSource);
  const bridgeState = useAimpStore((state) => state.bridgeState);
  const liveStreamStarted = bridgeState.liveStreamStarted;
  const publishingBridgeReady = useAimpStore((state) => state.publishingBridgeReady);
  const connectionPhase = bridgeState.connection.phase;
  const playbackStatus = bridgeState.playbackSnapshot?.status;
  const setPublishingPathState = useAimpStore((state) => state.setPublishingPathState);

  const broadcastSourceRef = useRef(new AimpBroadcastSource());
  const onPartyNotFoundRef = useRef(onPartyNotFound);

  useEffect(() => {
    onPartyNotFoundRef.current = onPartyNotFound;
  }, [onPartyNotFound]);

  const networkEnabled = isStreamingNetworkEnabled({ enableStreaming });
  const orchestratorActive =
    hasHydrated && networkEnabled && streamingSource === 'aimp' && partyId !== null;

  useEffect(() => {
    if (!orchestratorActive || !partyId) {
      setPublishingPathState('idle');
      return;
    }

    setPublishingPathState('connecting');
    streamingOrchestrator.start({
      partyId,
      broadcastSource: broadcastSourceRef.current,
      streamingSource: 'aimp',
      networkSettings: { enableStreaming },
      onConnectionStateChange: (state) => {
        if (state === signalR.HubConnectionState.Connecting) {
          setPublishingPathState('connecting');
        } else if (state === signalR.HubConnectionState.Connected) {
          setPublishingPathState('ready');
        }
      },
      onPartyNotFound: () => {
        setPublishingPathState('error', formatAimpPublishingPathError('checkPartyExists'));
        onPartyNotFoundRef.current?.();
      },
      onConnectError: (error) => {
        setPublishingPathState('error', formatAimpPublishingPathError('connect', error));
      },
      onPublishError: (operation, error) => {
        setPublishingPathState('error', formatAimpPublishingPathError(operation, error));
      },
      onPublishSuccess: () => {
        setPublishingPathState('ready');
      },
    });

    return () => {
      if (streamingOrchestrator.activeConfig?.streamingSource === 'aimp') {
        void streamingOrchestrator.teardown();
      }
    };
  }, [orchestratorActive, partyId, enableStreaming, setPublishingPathState, streamingSource]);

  useEffect(() => {
    if (!orchestratorActive || !partyId) {
      return;
    }

    streamingOrchestrator.syncLiveSession(broadcastSourceRef.current.isLiveSessionActive());
  }, [
    orchestratorActive,
    partyId,
    liveStreamStarted,
    publishingBridgeReady,
    connectionPhase,
    playbackStatus,
  ]);

  useEffect(() => {
    if (!orchestratorActive || !partyId) {
      return;
    }

    streamingOrchestrator.syncAimpFrozenState(enableStreaming);
  }, [bridgeState, enableStreaming, orchestratorActive, partyId, publishingBridgeReady]);
}
