import * as signalR from '@microsoft/signalr';
import { useCallback, useEffect, useRef, useState } from 'react';

import { signalRService } from '../services/signalRService';
import { useSettingsStore } from '../stores';

import { CherryPlayPlayerBroadcastSource } from './CherryPlayPlayerBroadcastSource';
import { isStreamingHubAllowed, isStreamingNetworkEnabled } from './onlineNetworkPolicy';
import type { PlaylistForApiPayload } from './PlaybackBroadcastSource';
import { streamingOrchestrator } from './streamingOrchestrator';

export interface UseStreamingOrchestratorOptions {
  partyId: string | null;
  sessionMode: 'preparation' | 'session';
  onPartyNotFound?: () => void;
  onPlaylistSynced?: (payload: PlaylistForApiPayload) => void;
}

export interface UseStreamingOrchestratorResult {
  connectionState: signalR.HubConnectionState | null;
  reconnect: () => void;
}

export function useStreamingOrchestrator(
  options: UseStreamingOrchestratorOptions,
): UseStreamingOrchestratorResult {
  const { partyId, sessionMode, onPartyNotFound, onPlaylistSynced } = options;
  const enableStreaming = useSettingsStore((state) => state.enableStreaming);
  const streamingSource = useSettingsStore((state) => state.streamingSource);

  const [hubConnectionState, setHubConnectionState] = useState<signalR.HubConnectionState | null>(
    null,
  );
  const broadcastSourceRef = useRef(new CherryPlayPlayerBroadcastSource());
  const onPartyNotFoundRef = useRef(onPartyNotFound);
  const onPlaylistSyncedRef = useRef(onPlaylistSynced);

  useEffect(() => {
    onPartyNotFoundRef.current = onPartyNotFound;
  }, [onPartyNotFound]);

  useEffect(() => {
    onPlaylistSyncedRef.current = onPlaylistSynced;
  }, [onPlaylistSynced]);

  const networkEnabled = isStreamingNetworkEnabled({ enableStreaming });
  const hubAllowed = isStreamingHubAllowed({ enableStreaming });
  const orchestratorActive =
    hubAllowed && streamingSource === 'cherryPlayPlayer' && partyId !== null;

  const connectionState = networkEnabled && orchestratorActive ? hubConnectionState : null;

  useEffect(() => {
    if (!orchestratorActive || !partyId) {
      if (streamingOrchestrator.activeConfig?.streamingSource === 'cherryPlayPlayer') {
        void streamingOrchestrator.teardown();
      }

      return;
    }

    streamingOrchestrator.start({
      partyId,
      broadcastSource: broadcastSourceRef.current,
      streamingSource: 'cherryPlayPlayer',
      networkSettings: { enableStreaming },
      onConnectionStateChange: setHubConnectionState,
      onPartyNotFound: () => onPartyNotFoundRef.current?.(),
      onPlaylistSynced: (payload) => onPlaylistSyncedRef.current?.(payload),
    });

    return () => {
      if (streamingOrchestrator.activeConfig?.streamingSource === 'cherryPlayPlayer') {
        void streamingOrchestrator.teardown();
      }
    };
  }, [orchestratorActive, partyId, enableStreaming, hubAllowed, streamingSource]);

  useEffect(() => {
    if (!orchestratorActive || !partyId) {
      return;
    }

    streamingOrchestrator.syncLiveSession(sessionMode === 'session');
  }, [orchestratorActive, partyId, sessionMode]);

  useEffect(() => {
    if (!orchestratorActive) {
      return;
    }

    const interval = setInterval(() => {
      setHubConnectionState(signalRService.getConnectionState());
    }, 1000);

    return () => clearInterval(interval);
  }, [orchestratorActive]);

  const reconnect = useCallback(() => {
    streamingOrchestrator.reconnect();
  }, []);

  return { connectionState, reconnect };
}
