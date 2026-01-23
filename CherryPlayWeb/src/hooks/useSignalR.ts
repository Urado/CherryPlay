/**
 * Хук для управления SignalR подключением
 * Инкапсулирует логику подключения/отключения и подписки на события
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import { signalRService } from '../services/signalRService';
import type { PlaybackStateDto } from '../types/api';

export interface UseSignalROptions {
  shortCode?: string;
  onSessionStarted?: (partyId: string) => void;
  onSessionEnded?: (partyId: string) => void;
  onPlaybackPositionUpdated?: (partyId: string, trackId: string, position: number) => void;
  onFullStateUpdated?: (partyId: string, state: PlaybackStateDto) => void;
  onStateChanged?: (partyId: string) => void;
  onPlaylistChanged?: (partyId: string) => void;
  onConnectionStatusChanged?: (partyId: string, isOnline: boolean) => void;
  onError?: (error: string) => void;
  autoConnect?: boolean;
}

export interface UseSignalRReturn {
  isConnected: boolean;
  connectionStatus: 'disconnected' | 'connecting' | 'connected';
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  joinPartyAsViewer: (shortCode: string) => Promise<void>;
  requestFullState: (shortCode: string) => Promise<any>;
}

/**
 * Хук для работы с SignalR
 */
export function useSignalR(options: UseSignalROptions = {}): UseSignalRReturn {
  const {
    shortCode,
    onSessionStarted,
    onSessionEnded,
    onPlaybackPositionUpdated,
    onFullStateUpdated,
    onStateChanged,
    onPlaylistChanged,
    onConnectionStatusChanged,
    onError,
    autoConnect = false,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const callbacksRef = useRef({
    onSessionStarted,
    onSessionEnded,
    onPlaybackPositionUpdated,
    onFullStateUpdated,
    onStateChanged,
    onPlaylistChanged,
    onConnectionStatusChanged,
    onError,
  });

  // Обновляем ref при изменении callbacks
  useEffect(() => {
    callbacksRef.current = {
      onSessionStarted,
      onSessionEnded,
      onPlaybackPositionUpdated,
      onFullStateUpdated,
      onStateChanged,
      onPlaylistChanged,
      onConnectionStatusChanged,
      onError,
    };
  }, [
    onSessionStarted,
    onSessionEnded,
    onPlaybackPositionUpdated,
    onFullStateUpdated,
    onStateChanged,
    onPlaylistChanged,
    onConnectionStatusChanged,
    onError,
  ]);

  // Устанавливаем подписки на события
  useEffect(() => {
    if (onSessionStarted) {
      signalRService.onSessionStarted((partyId) => {
        callbacksRef.current.onSessionStarted?.(partyId);
      });
    }

    if (onSessionEnded) {
      signalRService.onSessionEnded((partyId) => {
        callbacksRef.current.onSessionEnded?.(partyId);
      });
    }

    if (onPlaybackPositionUpdated) {
      signalRService.onPlaybackPositionUpdated((partyId, trackId, position) => {
        callbacksRef.current.onPlaybackPositionUpdated?.(partyId, trackId, position);
      });
    }

    if (onFullStateUpdated) {
      signalRService.onFullStateUpdated((partyId, state) => {
        callbacksRef.current.onFullStateUpdated?.(partyId, state);
      });
    }

    if (onStateChanged) {
      signalRService.onStateChanged((partyId) => {
        callbacksRef.current.onStateChanged?.(partyId);
      });
    }

    if (onPlaylistChanged) {
      signalRService.onPlaylistChanged((partyId) => {
        callbacksRef.current.onPlaylistChanged?.(partyId);
      });
    }

    if (onConnectionStatusChanged) {
      signalRService.onConnectionStatusChanged((partyId, isOnline) => {
        callbacksRef.current.onConnectionStatusChanged?.(partyId, isOnline);
      });
    }

    if (onError) {
      signalRService.onError((error) => {
        callbacksRef.current.onError?.(error);
      });
    }

    // Очистка подписок при размонтировании
    return () => {
      if (onSessionStarted) signalRService.off('OnSessionStarted');
      if (onSessionEnded) signalRService.off('OnSessionEnded');
      if (onPlaybackPositionUpdated) signalRService.off('OnPlaybackPositionUpdated');
      if (onFullStateUpdated) signalRService.off('OnFullStateUpdated');
      if (onStateChanged) signalRService.off('OnStateChanged');
      if (onPlaylistChanged) signalRService.off('OnPlaylistChanged');
      if (onConnectionStatusChanged) signalRService.off('OnConnectionStatusChanged');
      if (onError) signalRService.off('Error');
    };
  }, [
    onSessionStarted,
    onSessionEnded,
    onPlaybackPositionUpdated,
    onFullStateUpdated,
    onStateChanged,
    onPlaylistChanged,
    onConnectionStatusChanged,
    onError,
  ]);

  // Проверка статуса подключения
  useEffect(() => {
    const checkConnection = () => {
      const connected = signalRService.isServiceConnected();
      setIsConnected(connected);
      if (connected && connectionStatus !== 'connected') {
        setConnectionStatus('connected');
      } else if (!connected && connectionStatus === 'connected') {
        setConnectionStatus('disconnected');
      }
    };

    const interval = setInterval(checkConnection, 1000);
    return () => clearInterval(interval);
  }, [connectionStatus]);

  const connect = useCallback(async () => {
    if (!shortCode) {
      return;
    }

    try {
      setConnectionStatus('connecting');
      await signalRService.connect();
      
      // Небольшая задержка для проверки соединения
      await new Promise(resolve => setTimeout(resolve, 500));
      
      if (!signalRService.isServiceConnected()) {
        throw new Error('Не удалось установить соединение');
      }
      
      await signalRService.joinPartyAsViewer(shortCode);
      setConnectionStatus('connected');
      setIsConnected(true);
    } catch (err) {
      setConnectionStatus('disconnected');
      setIsConnected(false);
      throw err;
    }
  }, [shortCode]);

  const disconnect = useCallback(async () => {
    setConnectionStatus('disconnected');
    setIsConnected(false);
    await signalRService.disconnect();
  }, []);

  const joinPartyAsViewer = useCallback(async (code: string) => {
    await signalRService.joinPartyAsViewer(code);
  }, []);

  const requestFullState = useCallback(async (code: string) => {
    return await signalRService.requestFullState(code);
  }, []);

  // Автоматическое подключение
  const autoConnectingRef = useRef(false);
  useEffect(() => {
    if (autoConnect && shortCode && !isConnected && connectionStatus === 'disconnected' && !autoConnectingRef.current) {
      autoConnectingRef.current = true;
      connect()
        .then(() => {
          autoConnectingRef.current = false;
        })
        .catch((err) => {
          console.error('[useSignalR] Auto-connect failed:', err);
          autoConnectingRef.current = false;
          // НЕ пытаемся подключиться снова автоматически
        });
    }
  }, [autoConnect, shortCode, isConnected, connectionStatus, connect]);

  return {
    isConnected,
    connectionStatus,
    connect,
    disconnect,
    joinPartyAsViewer,
    requestFullState,
  };
}
