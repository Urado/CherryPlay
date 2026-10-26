import { act, renderHook, waitFor } from '@testing-library/react';

type Track = import('../../../src/core/types/track').Track;
type TrackLoudness = import('../../../src/core/types/track').TrackLoudness;
type ScanOptions = { consumer: 'sessionLookahead' };
const scanTrack = jest.fn<Promise<TrackLoudness>, [Track, ScanOptions]>();
const isMeasurementCurrent = jest.fn<Promise<boolean>, [Track]>();
const scanTracks = jest.fn<
  Promise<void>,
  [Track[], ((progress: unknown) => void)?, { cancelled: boolean }?]
>();
const audioState: {
  currentTrack: Track | null;
  status: string;
  position: number;
  loadTrack: (track: Track, shouldAutoPlay?: boolean) => Promise<number>;
  play: () => Promise<void>;
  pause: () => void;
  setOnTrackEnded: (handler?: () => void) => void;
  setPauseTimer: (callback: () => void, timeout: number) => void;
  clearPauseTimer: () => void;
  stop: () => void;
  shouldAutoPlayTrack: (trackId: string, generation: number) => boolean;
} = {
  currentTrack: null,
  status: 'paused',
  position: 0,
  loadTrack: () => Promise.resolve(1),
  play: () => Promise.resolve(),
  pause: () => undefined,
  setOnTrackEnded: () => undefined,
  setPauseTimer: () => undefined,
  clearPauseTimer: () => undefined,
  stop: () => undefined,
  shouldAutoPlayTrack: () => true,
};
const projectState = {
  sessionState: { mode: 'session' as 'session' | 'preparation' },
  meta: { linkedParty: null },
  settings: { defaultActionAfterTrack: 'next', defaultPauseBetweenTracks: 0 },
  getTrackSettings: () => ({}),
  getGroupSettings: () => ({}),
  startSession: jest.fn(),
  resetSession: jest.fn(),
  setCurrentTrack: jest.fn(),
};
const useProjectStore = Object.assign(
  jest.fn((selector?: (state: typeof projectState) => unknown) =>
    selector ? selector(projectState) : projectState,
  ),
  { getState: () => projectState },
);
const usePlayerAudioStore = Object.assign(
  jest.fn(() => audioState),
  { getState: () => audioState },
);
const useAimpStore = { getState: () => ({ bridgeState: null }) };
const useDemoPlayerStore = { getState: () => ({ setDisabled: jest.fn() }) };
const useSettingsStore = {
  getState: () => ({
    streamingSource: 'cherryPlayPlayer',
    loudnessNormalizationEnabled: true,
    playerAudioDeviceId: 'player-device',
    demoPlayerAudioDeviceId: 'demo-device',
  }),
};
let endedCallback: (() => void) | undefined;

jest.mock('@shared/services', () => ({
  loudnessService: {
    scanTrack: (...args: Parameters<typeof scanTrack>) => scanTrack(...args),
    isMeasurementCurrent: (...args: Parameters<typeof isMeasurementCurrent>) =>
      isMeasurementCurrent(...args),
    scanTracks: (...args: Parameters<typeof scanTracks>) => scanTracks(...args),
  },
}));
jest.mock('../../../src/shared/services/loudnessService', () => ({
  loudnessService: {
    scanTrack: (...args: Parameters<typeof scanTrack>) => scanTrack(...args),
    isMeasurementCurrent: (...args: Parameters<typeof isMeasurementCurrent>) =>
      isMeasurementCurrent(...args),
    scanTracks: (...args: Parameters<typeof scanTracks>) => scanTracks(...args),
  },
}));
jest.mock('@shared/stores', () => ({
  useProjectStore: (...args: Parameters<typeof useProjectStore>) => useProjectStore(...args),
  usePlayerAudioStore: Object.assign(() => usePlayerAudioStore(), { getState: () => audioState }),
  useAimpStore,
  useDemoPlayerStore,
  useSettingsStore,
}));
jest.mock('@shared/stores/playerAudioStore', () => ({
  usePlayerAudioStore: Object.assign(() => usePlayerAudioStore(), { getState: () => audioState }),
}));
jest.mock('@shared/hooks/usePlaybackPreview', () => ({
  usePlaybackPreview: () => ({
    startPlayback: jest.fn(),
    pausePlayback: jest.fn(),
    activeTrackId: undefined,
    playerStatus: 'paused',
  }),
}));
jest.mock('@workspaces/party/partyPlaybackSource', () => ({
  getPartyPlaybackSourceAdapter: () => ({ completionDetection: 'none' }),
  resolvePartyPlaybackSourceState: () => ({ sessionActive: false }),
}));
jest.mock('@workspaces/party/partyProgramEndedStore', () => ({ markPartyProgramEnded: jest.fn() }));
jest.mock('@workspaces/party/partyWorkspaceStore', () => ({
  usePartyWorkspaceStore: { getState: () => ({ partyLifecycleState: 'idle' }) },
}));
jest.mock('@shared/platform', () => ({
  getPlatformCapabilities: () => ({ supportsLoudnessAnalysis: true }),
  isDemoLiveMode: () => false,
}));
jest.mock('@shared/demo/demoLiveMockPlayback', () => ({
  startDemoLiveMockPlayback: jest.fn(),
  stopDemoLiveMockPlayback: jest.fn(),
}));

import { LOUDNESS_ALGORITHM_VERSION } from '../../../src/shared/contracts/loudness';
import { useLoudnessScanFlow } from '../../../src/workspaces/player/hooks/useLoudnessScanFlow';
import { usePlayerPlayback } from '../../../src/workspaces/player/hooks/usePlayerPlayback';
import { usePlayerSession } from '../../../src/workspaces/player/hooks/usePlayerSession';
import { usePlayerStateHelpers } from '../../../src/workspaces/player/hooks/usePlayerStateHelpers';
import {
  isTrackActive,
  isTrackOrGroupDisabled,
} from '../../../src/workspaces/player/utils/playerStateUtils';

const createTracks = (ids: string[]): Track[] =>
  ids.map((id) => ({ id, name: id, path: `D:/Music/${id}.flac` }));

const deferred = <T,>() => {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
};

const requestedTrackIds = (): string[] => [
  ...scanTrack.mock.calls.map(([track]) => track.id),
  ...scanTracks.mock.calls.flatMap(([tracks]) => tracks.map((track) => track.id)),
];

describe('player playback lookahead acceptance', () => {
  beforeEach(() => {
    endedCallback = undefined;
    scanTrack.mockReset().mockResolvedValue({ status: 'ok' });
    isMeasurementCurrent
      .mockReset()
      .mockImplementation((track) => Promise.resolve(track.loudness?.status === 'ok'));
    scanTracks.mockReset().mockResolvedValue(undefined);
    projectState.sessionState.mode = 'session';
    projectState.startSession.mockClear();
    audioState.currentTrack = null;
    audioState.status = 'paused';
    audioState.position = 0;
    audioState.loadTrack = jest.fn((track) => {
      audioState.currentTrack = track;
      audioState.status = 'loading';
      return Promise.resolve(1);
    });
    audioState.play = jest.fn(() => {
      audioState.status = 'playing';
      return Promise.resolve();
    });
    audioState.pause = jest.fn();
    audioState.setOnTrackEnded = jest.fn((handler) => {
      endedCallback = handler;
    });
    audioState.setPauseTimer = jest.fn();
    audioState.clearPauseTimer = jest.fn();
    audioState.stop = jest.fn();
    audioState.shouldAutoPlayTrack = jest.fn(() => true);
  });

  it('uses production effective queue selection for start and natural next-track lookahead', async () => {
    const rawTracks = createTracks([
      'track-1',
      'track-2',
      'track-3',
      'track-4',
      'track-5',
      'track-6',
      'track-7',
      'track-8',
      'track-9',
    ]);
    const disabledGroup = { id: 'group-disabled', name: 'Disabled', items: rawTracks.slice(3, 5) };
    const paths = new Map(rawTracks.map((track) => [track.id, [track.id]]));
    paths.set('track-4', ['group-disabled', 'track-4']);
    paths.set('track-5', ['group-disabled', 'track-5']);
    const played = new Set(['track-2']);
    const disabledTracks = new Set(['track-3']);
    const disabledGroups = new Set(['group-disabled']);
    const findItemById = (id: string) =>
      id === disabledGroup.id
        ? disabledGroup
        : (rawTracks.find((track) => track.id === id) ?? null);
    const getItemPath = (id: string) => paths.get(id) ?? [id];
    const isActive = (id: string) =>
      isTrackActive(
        id,
        (trackId) => played.has(trackId),
        (trackId) =>
          isTrackOrGroupDisabled(
            trackId,
            (trackIdToCheck) => disabledTracks.has(trackIdToCheck),
            (groupId) => disabledGroups.has(groupId),
            getItemPath,
            findItemById,
          ),
      );
    const { rerender } = renderHook(() => {
      const effectiveTracks = rawTracks.filter((track) => isActive(track.id));
      const queue = usePlayerStateHelpers({
        allTracks: effectiveTracks,
        activePlayerTrackId: audioState.currentTrack?.id,
        getItemPath,
        findItemById,
        isTrackActive: isActive,
      });
      return usePlayerPlayback({
        allTracks: effectiveTracks,
        getEffectiveTrackSettings: () => ({ actionAfterTrack: 'next', pauseBetweenTracks: 0 }),
        getNextActiveTrack: queue.getNextActiveTrack,
        markTrackAsPlayed: jest.fn(),
        markSkippedDisabledTracks: jest.fn(),
        setCurrentTrack: jest.fn(),
      });
    });

    audioState.currentTrack = rawTracks[0] ?? null;
    audioState.status = 'playing';
    rerender();
    await act(async () => Promise.resolve());
    expect(requestedTrackIds()).toEqual(['track-6', 'track-7', 'track-8']);

    await act(async () => {
      endedCallback?.();
      for (let index = 0; index < 20; index++) await Promise.resolve();
    });
    rerender();
    expect(audioState.currentTrack?.id).toBe('track-6');
    await waitFor(() =>
      expect(requestedTrackIds()).toEqual([
        'track-6',
        'track-7',
        'track-8',
        'track-7',
        'track-8',
        'track-9',
      ]),
    );
  });

  it('does not scan from position-only updates or in preparation mode', async () => {
    projectState.sessionState.mode = 'preparation';
    const tracks = createTracks(['track-1', 'track-2', 'track-3', 'track-4']);
    audioState.currentTrack = tracks[0] ?? null;
    audioState.status = 'playing';
    const { rerender } = renderHook(() =>
      usePlayerPlayback({
        allTracks: tracks,
        getEffectiveTrackSettings: () => ({ actionAfterTrack: 'next', pauseBetweenTracks: 0 }),
        getNextActiveTrack: () => tracks[1] ?? null,
        markTrackAsPlayed: jest.fn(),
        markSkippedDisabledTracks: jest.fn(),
        setCurrentTrack: jest.fn(),
      }),
    );
    audioState.position = 42;
    rerender();
    await act(async () => Promise.resolve());
    expect(requestedTrackIds()).toEqual([]);
  });

  it('rescans ok measurements with stale algorithm versions or file mtimes and applies fresh results', async () => {
    const [current, staleAlgorithm, staleMtime, currentMeasurement] = createTracks([
      'current',
      'stale-algorithm',
      'stale-mtime',
      'current-measurement',
    ]);
    if (!current || !staleAlgorithm || !staleMtime || !currentMeasurement) return;
    staleAlgorithm.loudness = {
      status: 'ok',
      fileMtime: 100,
      algorithmVersion: 0,
      trackGainDb: 1,
    };
    staleMtime.loudness = {
      status: 'ok',
      fileMtime: 90,
      algorithmVersion: LOUDNESS_ALGORITHM_VERSION,
      trackGainDb: 1,
    };
    currentMeasurement.loudness = {
      status: 'ok',
      fileMtime: 100,
      algorithmVersion: LOUDNESS_ALGORITHM_VERSION,
      trackGainDb: 1,
    };
    isMeasurementCurrent.mockImplementation((track) =>
      Promise.resolve(
        track.loudness?.algorithmVersion === LOUDNESS_ALGORITHM_VERSION &&
          track.loudness.fileMtime === 100,
      ),
    );
    const freshResult: TrackLoudness = {
      status: 'ok',
      fileMtime: 100,
      algorithmVersion: LOUDNESS_ALGORITHM_VERSION,
      trackGainDb: 3,
    };
    const persisted = new Map<string, TrackLoudness>();
    scanTrack.mockImplementation((track) => {
      persisted.set(track.id, freshResult);
      return Promise.resolve(freshResult);
    });
    const tracks = [current, staleAlgorithm, staleMtime, currentMeasurement];
    audioState.currentTrack = current;
    audioState.status = 'playing';
    renderHook(() =>
      usePlayerPlayback({
        allTracks: tracks,
        getEffectiveTrackSettings: () => ({ actionAfterTrack: 'next', pauseBetweenTracks: 0 }),
        getNextActiveTrack: () => staleAlgorithm,
        markTrackAsPlayed: jest.fn(),
        markSkippedDisabledTracks: jest.fn(),
        setCurrentTrack: jest.fn(),
      }),
    );
    await act(async () => {
      for (let index = 0; index < 20; index++) await Promise.resolve();
    });

    expect(scanTrack).toHaveBeenNthCalledWith(1, staleAlgorithm, {
      consumer: 'sessionLookahead',
    });
    expect(scanTrack).toHaveBeenNthCalledWith(2, staleMtime, {
      consumer: 'sessionLookahead',
    });
    expect(scanTrack).toHaveBeenCalledTimes(2);
    expect(persisted.get(staleAlgorithm.id)).toBe(freshResult);
    expect(persisted.get(staleMtime.id)).toBe(freshResult);
  });

  it('restarts lookahead when played and disabled state changes the queue for the same current track', async () => {
    const tracks = createTracks([
      'current',
      'played-next',
      'disabled-next',
      'next-three',
      'next-four',
    ]);
    const played = new Set<string>();
    const disabled = new Set<string>();
    const getItemPath = (trackId: string) => [trackId];
    const findItemById = (trackId: string) => tracks.find((track) => track.id === trackId) ?? null;
    const isActive = (trackId: string) =>
      isTrackActive(
        trackId,
        (id) => played.has(id),
        (id) =>
          isTrackOrGroupDisabled(
            id,
            (candidate) => disabled.has(candidate),
            () => false,
            getItemPath,
            findItemById,
          ),
      );
    audioState.currentTrack = tracks[0] ?? null;
    audioState.status = 'playing';
    const { rerender } = renderHook(() => {
      const effectiveTracks = tracks.filter((track) => isActive(track.id));
      const queue = usePlayerStateHelpers({
        allTracks: effectiveTracks,
        activePlayerTrackId: audioState.currentTrack?.id,
        getItemPath,
        findItemById,
        isTrackActive: isActive,
      });
      return usePlayerPlayback({
        allTracks: effectiveTracks,
        getEffectiveTrackSettings: () => ({ actionAfterTrack: 'next', pauseBetweenTracks: 0 }),
        getNextActiveTrack: queue.getNextActiveTrack,
        markTrackAsPlayed: jest.fn(),
        markSkippedDisabledTracks: jest.fn(),
        setCurrentTrack: jest.fn(),
      });
    });
    await act(async () => {
      for (let index = 0; index < 20; index++) await Promise.resolve();
    });
    expect(scanTrack.mock.calls.map(([track]) => track.id)).toEqual([
      'played-next',
      'disabled-next',
      'next-three',
    ]);

    played.add('played-next');
    disabled.add('disabled-next');
    rerender();
    await act(async () => {
      for (let index = 0; index < 20; index++) await Promise.resolve();
    });

    expect(audioState.currentTrack?.id).toBe('current');
    expect(scanTrack.mock.calls.map(([track]) => track.id)).toEqual([
      'played-next',
      'disabled-next',
      'next-three',
      'next-three',
      'next-four',
    ]);
  });

  it('completes session start before deferred lookahead scans resolve', async () => {
    const [current, nextOne, nextTwo, nextThree] = createTracks([
      'session-current',
      'session-next-one',
      'session-next-two',
      'session-next-three',
    ]);
    if (!current || !nextOne || !nextTwo || !nextThree) return;
    const tracks = [current, nextOne, nextTwo, nextThree];
    const gateScan = deferred<void>();
    const lookaheadResolvers = new Map<string, (value: TrackLoudness) => void>();
    const streamingStart = jest.fn().mockResolvedValue(undefined);
    scanTracks.mockImplementation(() => gateScan.promise);
    scanTrack.mockImplementation(
      (track) =>
        new Promise<TrackLoudness>((resolve) => {
          lookaheadResolvers.set(track.id, resolve);
        }),
    );

    const { result, rerender } = renderHook(() => {
      usePlayerPlayback({
        allTracks: tracks,
        getEffectiveTrackSettings: () => ({ actionAfterTrack: 'next', pauseBetweenTracks: 0 }),
        getNextActiveTrack: () => {
          const currentIndex = tracks.findIndex(
            (track) => track.id === audioState.currentTrack?.id,
          );
          return tracks[currentIndex + 1] ?? null;
        },
        markTrackAsPlayed: jest.fn(),
        markSkippedDisabledTracks: jest.fn(),
        setCurrentTrack: projectState.setCurrentTrack,
      });
      const scanFlow = useLoudnessScanFlow();
      return usePlayerSession({
        allTracks: tracks,
        isTrackActive: () => true,
        onSessionStart: streamingStart,
        beforeStartSession: () =>
          scanFlow.ensureSessionGateReady(
            tracks,
            () => true,
            (freshTracks) => freshTracks,
          ),
      });
    });

    let startPromise: Promise<void> | undefined;
    await act(async () => {
      startPromise = result.current.handleStartSession();
      for (let index = 0; index < 20; index++) await Promise.resolve();
    });
    expect(scanTracks).toHaveBeenCalledTimes(1);
    const gatedTrackIds = scanTracks.mock.calls[0]?.[0].map((track) => track.id);

    await act(async () => {
      gateScan.resolve();
      await startPromise;
    });
    expect(streamingStart).toHaveBeenCalledTimes(1);
    expect(audioState.currentTrack?.id).toBe(current.id);
    expect(audioState.status).toBe('playing');

    rerender();
    await act(async () => {
      for (let index = 0; index < 30; index++) await Promise.resolve();
    });

    expect(scanTrack.mock.calls.map(([track]) => track.id)).toEqual([
      nextOne.id,
      nextTwo.id,
      nextThree.id,
    ]);
    expect(lookaheadResolvers.size).toBe(3);
    expect(gatedTrackIds).toEqual([current.id]);

    lookaheadResolvers.forEach((resolve) => resolve({ status: 'ok', trackGainDb: 2 }));
    await act(async () => {
      for (let index = 0; index < 20; index++) await Promise.resolve();
    });
  });
});
