import * as signalR from '@microsoft/signalr';
import { useProjectStore, useUIStore } from '@shared/stores';
import { useStreamingOrchestrator } from '@shared/streaming';
import { createCherryPlayStreamingErrorHandlers } from '@shared/streaming/cherryPlayStreamingErrors';
import {
  getCurrentPartyPublishSyncParts,
  markPartyPublishPlaylistSynced,
} from '@workspaces/party/partyPublishSync';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react';

interface CherryPlayStreamingConnectionValue {
  connectionState: signalR.HubConnectionState | null;
  reconnect: () => void;
}

const defaultConnectionValue: CherryPlayStreamingConnectionValue = {
  connectionState: null,
  reconnect: () => {},
};

const CherryPlayStreamingConnectionContext =
  createContext<CherryPlayStreamingConnectionValue>(defaultConnectionValue);

export function useCherryPlayStreamingConnection(): CherryPlayStreamingConnectionValue {
  return useContext(CherryPlayStreamingConnectionContext);
}

interface CherryPlayStreamingControllerProps {
  children: React.ReactNode;
}

export const CherryPlayStreamingController: React.FC<CherryPlayStreamingControllerProps> = ({
  children,
}) => {
  const linkedPartyId = useProjectStore((state) => state.meta.linkedParty?.id ?? null);
  const sessionMode = useProjectStore((state) => state.sessionState.mode);
  const addNotification = useUIStore((state) => state.addNotification);
  const reconnectRef = useRef(() => {});
  const errorHandlersRef = useRef(createCherryPlayStreamingErrorHandlers(addNotification));

  useEffect(() => {
    errorHandlersRef.current = createCherryPlayStreamingErrorHandlers(addNotification, {
      onReconnect: () => {
        reconnectRef.current();
      },
    });
  }, [addNotification]);

  const handlePartyNotFound = useCallback(() => {
    addNotification({
      type: 'warning',
      message: 'Подключённая вечеринка не найдена на сервере. Связь с проектом сохранена.',
      duration: 5000,
    });
  }, [addNotification]);

  const handlePlaylistSynced = useCallback(() => {
    markPartyPublishPlaylistSynced(getCurrentPartyPublishSyncParts().playlist);
  }, []);

  const handleConnectError = useCallback((error: unknown) => {
    errorHandlersRef.current.onConnectError(error);
  }, []);

  const handlePublishError = useCallback(
    (operation: 'playlistPublish' | 'fullStatePublish', error: unknown) => {
      errorHandlersRef.current.onPublishError(operation, error);
    },
    [],
  );

  const handleReconnectionFailed = useCallback(() => {
    errorHandlersRef.current.onReconnectionFailed();
  }, []);

  const { connectionState, reconnect } = useStreamingOrchestrator({
    partyId: linkedPartyId,
    sessionMode,
    onPartyNotFound: handlePartyNotFound,
    onPlaylistSynced: handlePlaylistSynced,
    onConnectError: handleConnectError,
    onPublishError: handlePublishError,
    onReconnectionFailed: handleReconnectionFailed,
  });

  useEffect(() => {
    reconnectRef.current = reconnect;
  }, [reconnect]);

  const value = useMemo(() => ({ connectionState, reconnect }), [connectionState, reconnect]);

  return (
    <CherryPlayStreamingConnectionContext.Provider value={value}>
      {children}
    </CherryPlayStreamingConnectionContext.Provider>
  );
};
