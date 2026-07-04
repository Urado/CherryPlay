import * as signalR from '@microsoft/signalr';
import React, { createContext, useCallback, useContext, useMemo } from 'react';

import { useProjectStore, useUIStore } from '@shared/stores';
import { useStreamingOrchestrator } from '@shared/streaming';

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

  const handlePartyNotFound = useCallback(() => {
    useProjectStore.getState().setLinkedParty(null);
    addNotification({
      type: 'warning',
      message: 'Привязанная вечеринка не найдена на сервере. Привязка удалена.',
      duration: 5000,
    });
  }, [addNotification]);

  const { connectionState, reconnect } = useStreamingOrchestrator({
    partyId: linkedPartyId,
    sessionMode,
    onPartyNotFound: handlePartyNotFound,
  });

  const value = useMemo(() => ({ connectionState, reconnect }), [connectionState, reconnect]);

  return (
    <CherryPlayStreamingConnectionContext.Provider value={value}>
      {children}
    </CherryPlayStreamingConnectionContext.Provider>
  );
};
