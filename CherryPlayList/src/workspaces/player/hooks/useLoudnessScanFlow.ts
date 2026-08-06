import { useCallback, useRef, useState } from 'react';

import type { Track } from '@core/types/track';
import { getPlatformCapabilities } from '@shared/platform';
import {
  loudnessService,
  type LoudnessCancelToken,
  type LoudnessScanProgress,
} from '@shared/services';
import { useSettingsStore } from '@shared/stores';
import {
  areGateTracksReady,
  getGateTracksNotReady,
  getSessionGateTracks,
} from '@shared/utils/loudnessSessionGate';

export type LoudnessScanFlowState = {
  open: boolean;
  title: string;
  completed: number;
  total: number;
  currentTrackName: string | null;
  errorMessage: string | null;
};

const INITIAL_SCAN_STATE: LoudnessScanFlowState = {
  open: false,
  title: '',
  completed: 0,
  total: 0,
  currentTrackName: null,
  errorMessage: null,
};

const PENDING_POLL_MS = 200;
const PENDING_POLL_MAX_ATTEMPTS = 300;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

async function waitForPendingGateTracks(
  gateTracks: Track[],
  resolveFreshTracks: (tracks: Track[]) => Track[],
  cancelToken: LoudnessCancelToken,
): Promise<void> {
  for (let attempt = 0; attempt < PENDING_POLL_MAX_ATTEMPTS; attempt += 1) {
    if (cancelToken.cancelled) {
      return;
    }

    const freshTracks = resolveFreshTracks(gateTracks);
    const hasPending = freshTracks.some((track) => track.loudness?.status === 'pending');
    if (!hasPending || areGateTracksReady(freshTracks)) {
      return;
    }

    await delay(PENDING_POLL_MS);
  }
}

function buildGateErrorMessage(tracks: Track[]): string | null {
  const failed = tracks.filter((track) => track.loudness?.status === 'error');
  if (failed.length === 0) {
    return null;
  }
  const names = failed.map((track) => track.name).join(', ');
  return `Не удалось проанализировать: ${names}`;
}

export function useLoudnessScanFlow() {
  const [scanState, setScanState] = useState<LoudnessScanFlowState>(INITIAL_SCAN_STATE);
  const cancelTokenRef = useRef<LoudnessCancelToken | null>(null);

  const cancelScan = useCallback(() => {
    if (cancelTokenRef.current) {
      cancelTokenRef.current.cancelled = true;
    }
    cancelTokenRef.current = null;
    setScanState(INITIAL_SCAN_STATE);
  }, []);

  const runScan = useCallback(async (tracks: Track[], title: string): Promise<boolean> => {
    if (tracks.length === 0) {
      return true;
    }

    const cancelToken: LoudnessCancelToken = { cancelled: false };
    cancelTokenRef.current = cancelToken;

    setScanState({
      open: true,
      title,
      completed: 0,
      total: tracks.length,
      currentTrackName: tracks[0]?.name ?? null,
      errorMessage: null,
    });

    const onProgress = (progress: LoudnessScanProgress) => {
      if (cancelToken.cancelled) {
        return;
      }
      setScanState((prev) => ({
        ...prev,
        completed: progress.completed,
        total: progress.total,
        currentTrackName: progress.track.name,
      }));
    };

    try {
      await loudnessService.scanTracks(tracks, onProgress, cancelToken);
    } finally {
      cancelTokenRef.current = null;
    }

    if (cancelToken.cancelled) {
      setScanState(INITIAL_SCAN_STATE);
      return false;
    }

    setScanState(INITIAL_SCAN_STATE);
    return true;
  }, []);

  const ensureSessionGateReady = useCallback(
    async (
      allTracks: Track[],
      isTrackActive: (trackId: string) => boolean,
      resolveFreshTracks: (tracks: Track[]) => Track[],
    ): Promise<boolean> => {
      const settings = useSettingsStore.getState();
      if (!settings.loudnessNormalizationEnabled) {
        return true;
      }

      try {
        if (!getPlatformCapabilities().supportsLoudnessAnalysis) {
          return true;
        }
      } catch {
        return true;
      }

      const gateTracks = getSessionGateTracks(allTracks, isTrackActive);
      const gateCancelToken: LoudnessCancelToken = { cancelled: false };
      cancelTokenRef.current = gateCancelToken;

      await waitForPendingGateTracks(gateTracks, resolveFreshTracks, gateCancelToken);
      if (gateCancelToken.cancelled) {
        cancelTokenRef.current = null;
        return false;
      }

      const freshBeforeScan = resolveFreshTracks(gateTracks);
      if (areGateTracksReady(freshBeforeScan)) {
        cancelTokenRef.current = null;
        return true;
      }

      const scanned = await runScan(
        freshBeforeScan,
        'Подготовка к началу сессии: анализ громкости',
      );
      if (!scanned) {
        return false;
      }

      const freshGateTracks = resolveFreshTracks(gateTracks);
      if (areGateTracksReady(freshGateTracks)) {
        return true;
      }

      const notReady = getGateTracksNotReady(freshGateTracks);
      setScanState({
        open: true,
        title: 'Не удалось подготовить громкость',
        completed: freshGateTracks.length - notReady.length,
        total: freshGateTracks.length,
        currentTrackName: notReady[0]?.name ?? null,
        errorMessage: buildGateErrorMessage(freshGateTracks),
      });
      return false;
    },
    [runScan],
  );

  return {
    scanState,
    cancelScan,
    ensureSessionGateReady,
  };
}
