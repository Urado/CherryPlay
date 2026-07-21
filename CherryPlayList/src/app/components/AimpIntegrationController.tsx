import React, { useEffect, useRef } from 'react';

import {
  useAimpStore,
  useDemoPlayerStore,
  usePlayerAudioStore,
  useProjectStore,
  useSettingsStore,
  useUIStore,
} from '@shared/stores';
import { useAimpStreamingOrchestrator } from '@shared/streaming';
import { getAimpAvailability, logger } from '@shared/utils';

export const AimpIntegrationController: React.FC = () => {
  const initialize = useAimpStore((state) => state.initialize);
  const syncSourceSelection = useAimpStore((state) => state.syncSourceSelection);
  const setPublishingPathState = useAimpStore((state) => state.setPublishingPathState);

  const hasHydrated = useSettingsStore((state) => state._hasHydrated);
  const streamingSource = useSettingsStore((state) => state.streamingSource);
  const setStreamingSource = useSettingsStore((state) => state.setStreamingSource);

  const linkedPartyId = useProjectStore((state) => state.meta.linkedParty?.id ?? null);
  const addNotification = useUIStore((state) => state.addNotification);

  const previousStreamingSourceRef = useRef<typeof streamingSource | null>(null);

  useAimpStreamingOrchestrator({
    partyId: linkedPartyId,
    hasHydrated,
  });

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
              'AIMP недоступен. Возвращаемся к CherryPlay.',
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

    if (streamingSource !== 'aimp') {
      setPublishingPathState('idle');
      return;
    }

    if (previousSource === 'aimp') {
      return;
    }

    useProjectStore.getState().resetSession();
    usePlayerAudioStore.getState().clear();
    useDemoPlayerStore.getState().clear();
  }, [hasHydrated, setPublishingPathState, streamingSource]);

  useEffect(() => {
    return () => {
      setPublishingPathState('idle');
    };
  }, [setPublishingPathState]);

  return null;
};
