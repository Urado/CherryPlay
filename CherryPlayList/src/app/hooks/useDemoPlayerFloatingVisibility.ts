import { useEffect, useMemo, useRef } from 'react';

import type { Track } from '@core/types/track';
import type { PlayerStatus } from '@shared/stores/demoPlayerStore';

interface UseDemoPlayerFloatingVisibilityParams {
  hasDemoPlayerWorkspace: boolean;
  demoPlayerFloatingOpen: boolean;
  currentTrack: Track | null;
  demoPlayerStatus: PlayerStatus;
  setDemoPlayerFloatingOpen: (open: boolean) => void;
}

export interface DemoPlayerFloatingVisibilityState {
  hasActiveDemoSession: boolean;
  isFloatingVisible: boolean;
}

export function useDemoPlayerFloatingVisibility({
  hasDemoPlayerWorkspace,
  demoPlayerFloatingOpen,
  currentTrack,
  demoPlayerStatus,
  setDemoPlayerFloatingOpen,
}: UseDemoPlayerFloatingVisibilityParams): DemoPlayerFloatingVisibilityState {
  const previousActiveRef = useRef(false);
  const previousOpenRef = useRef(demoPlayerFloatingOpen);
  const sessionEpochRef = useRef(0);
  const suppressedAutoOpenContextRef = useRef<string | null>(null);

  const hasActiveDemoSession = useMemo(
    () => currentTrack !== null || demoPlayerStatus === 'playing' || demoPlayerStatus === 'loading',
    [currentTrack, demoPlayerStatus],
  );
  const trackContextKey = currentTrack?.id ?? 'no-track';

  useEffect(() => {
    if (hasActiveDemoSession && !previousActiveRef.current) {
      sessionEpochRef.current += 1;
      suppressedAutoOpenContextRef.current = null;
    }

    const didManuallyHideFloatingPanel =
      !hasDemoPlayerWorkspace &&
      previousOpenRef.current &&
      !demoPlayerFloatingOpen &&
      hasActiveDemoSession;

    if (didManuallyHideFloatingPanel) {
      suppressedAutoOpenContextRef.current = `${sessionEpochRef.current}:${trackContextKey}`;
    }

    if (demoPlayerFloatingOpen) {
      suppressedAutoOpenContextRef.current = null;
    }

    previousActiveRef.current = hasActiveDemoSession;
    previousOpenRef.current = demoPlayerFloatingOpen;
  }, [demoPlayerFloatingOpen, hasActiveDemoSession, hasDemoPlayerWorkspace, trackContextKey]);

  useEffect(() => {
    if (hasDemoPlayerWorkspace) {
      if (demoPlayerFloatingOpen) {
        setDemoPlayerFloatingOpen(false);
      }
      return;
    }

    const activeContextKey = `${sessionEpochRef.current}:${trackContextKey}`;
    const autoOpenAllowed = suppressedAutoOpenContextRef.current !== activeContextKey;
    if (hasActiveDemoSession && !demoPlayerFloatingOpen && autoOpenAllowed) {
      setDemoPlayerFloatingOpen(true);
      return;
    }

    if (!hasActiveDemoSession && demoPlayerFloatingOpen) {
      setDemoPlayerFloatingOpen(false);
    }
  }, [
    demoPlayerFloatingOpen,
    hasActiveDemoSession,
    hasDemoPlayerWorkspace,
    trackContextKey,
    setDemoPlayerFloatingOpen,
  ]);

  return {
    hasActiveDemoSession,
    isFloatingVisible: !hasDemoPlayerWorkspace && demoPlayerFloatingOpen,
  };
}
