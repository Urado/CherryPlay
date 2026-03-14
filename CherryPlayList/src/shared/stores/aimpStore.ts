import { createWithEqualityFn } from 'zustand/traditional';

import {
  createInitialAimpBridgeState,
  type AimpBridgeState,
  type AimpSourceSelection,
} from '../contracts/aimp';
import { aimpService } from '../services/aimpService';
import {
  createAimpPublishingPathState,
  type AimpPublishingPathState,
  type AimpPublishingPathStatus,
} from '../utils';
import { logger } from '../utils/logger';

let unsubscribeAimpBridge: (() => void) | null = null;
let unsubscribeAimpLog: (() => void) | null = null;
let initializePromise: Promise<void> | null = null;

function canUseRendererAimpBridge(): boolean {
  return typeof window !== 'undefined' && typeof window.api?.aimp !== 'undefined';
}

interface AimpStoreState {
  bridgeState: AimpBridgeState;
  isInitialized: boolean;
  isInitializing: boolean;
  lastError: string | null;
  publishingBridgeReady: boolean;
  publishingPath: AimpPublishingPathState;
  setBridgeState: (bridgeState: AimpBridgeState) => void;
  setPublishingBridgeReady: (publishingBridgeReady: boolean) => void;
  setPublishingPathState: (status: AimpPublishingPathStatus, error?: string | null) => void;
  initialize: () => Promise<void>;
  syncSourceSelection: (sourceSelection: AimpSourceSelection) => Promise<AimpBridgeState>;
  setLiveStreamStarted: (liveStreamStarted: boolean) => Promise<AimpBridgeState>;
  resetBridgeState: () => void;
}

export const useAimpStore = createWithEqualityFn<AimpStoreState>()((set, get) => ({
  bridgeState: createInitialAimpBridgeState(),
  isInitialized: false,
  isInitializing: false,
  lastError: null,
  publishingBridgeReady: false,
  publishingPath: createAimpPublishingPathState('idle'),

  setBridgeState: (bridgeState) =>
    set({
      bridgeState,
      lastError: null,
    }),

  setPublishingBridgeReady: (publishingBridgeReady) =>
    set({
      publishingBridgeReady,
      publishingPath: createAimpPublishingPathState(publishingBridgeReady ? 'ready' : 'idle'),
    }),

  setPublishingPathState: (status, error = null) =>
    set({
      publishingBridgeReady: status === 'ready',
      publishingPath: createAimpPublishingPathState(status, error),
    }),

  initialize: async () => {
    if (get().isInitialized || !canUseRendererAimpBridge()) {
      set({ isInitialized: true });
      return;
    }

    if (initializePromise) {
      await initializePromise;
      return;
    }

    set({
      isInitializing: true,
      lastError: null,
    });

    initializePromise = (async () => {
      try {
        const bridgeState = await aimpService.getState();
        set({
          bridgeState,
          isInitialized: true,
          lastError: null,
        });

        if (!unsubscribeAimpBridge) {
          unsubscribeAimpBridge = aimpService.subscribe((nextBridgeState) => {
            useAimpStore.getState().setBridgeState(nextBridgeState);
          });
        }
        if (!unsubscribeAimpLog) {
          unsubscribeAimpLog = aimpService.subscribeToLog((entry) => {
            const prefix = `[AIMP ${entry.level}] ${entry.event}: ${entry.message}`;
            if (
              entry.data !== undefined &&
              entry.data !== null &&
              Object.keys(entry.data as object).length > 0
            ) {
              console.log(prefix, entry.data);
            } else {
              console.log(prefix);
            }
          });
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to initialize AIMP renderer state';
        logger.error('[AIMP] Failed to initialize renderer store', error);
        set({
          lastError: message,
        });
        throw error;
      } finally {
        set({
          isInitializing: false,
        });
        initializePromise = null;
      }
    })();

    await initializePromise;
  },

  syncSourceSelection: async (sourceSelection) => {
    if (!canUseRendererAimpBridge()) {
      const bridgeState = {
        ...get().bridgeState,
        sourceSelection,
      };
      set({ bridgeState, isInitialized: true });
      return bridgeState;
    }

    await get().initialize();
    const bridgeState = await aimpService.setSourceSelection(sourceSelection);
    set({
      bridgeState,
      lastError: null,
    });
    return bridgeState;
  },

  setLiveStreamStarted: async (liveStreamStarted) => {
    if (!canUseRendererAimpBridge()) {
      const bridgeState = {
        ...get().bridgeState,
        liveStreamStarted,
      };
      set({ bridgeState, isInitialized: true });
      return bridgeState;
    }

    await get().initialize();
    const bridgeState = await aimpService.setLiveStreamStarted(liveStreamStarted);
    set({
      bridgeState,
      lastError: null,
    });
    return bridgeState;
  },

  resetBridgeState: () =>
    set({
      bridgeState: createInitialAimpBridgeState(),
      publishingBridgeReady: false,
      publishingPath: createAimpPublishingPathState('idle'),
      lastError: null,
      isInitialized: canUseRendererAimpBridge() ? get().isInitialized : true,
      isInitializing: false,
    }),
}));
