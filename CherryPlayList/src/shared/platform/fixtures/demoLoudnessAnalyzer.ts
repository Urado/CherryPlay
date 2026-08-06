import {
  computeAutoGainDb,
  DEFAULT_LOUDNESS_TARGET_LUFS,
  LOUDNESS_ALGORITHM_VERSION,
  MAX_TARGET_LUFS,
  MIN_TARGET_LUFS,
  type LoudnessAnalyzeResult,
} from '../../contracts/loudness';
import type { AudioFileStat, IPCResponse } from '../types';

import { DEMO_AUDIO_FILE_MTIME_MS, isDemoAudioFilePath } from './demoAudioExtensions';
import { DEMO_AUDIO_FILES } from './trackPaths';

export type DemoLoudnessProfile = {
  readonly integratedLufs: number;
  readonly truePeakDb: number;
  readonly lraLu: number;
  readonly lraLowLufs: number;
};

export const DEMO_LOUDNESS_PROFILES: Readonly<Record<string, DemoLoudnessProfile>> = {
  '/demo/music/Artist A/Album One/morning-light.mp3': {
    integratedLufs: -14.2,
    truePeakDb: -1.5,
    lraLu: 8.4,
    lraLowLufs: -22.1,
  },
  '/demo/music/Artist A/Album One/evening-echo.mp3': {
    integratedLufs: -22.6,
    truePeakDb: -3.4,
    lraLu: 11.2,
    lraLowLufs: -31.5,
  },
  '/demo/music/Artist A/loose-single.mp3': {
    integratedLufs: -18.0,
    truePeakDb: -2.0,
    lraLu: 7.1,
    lraLowLufs: -25.0,
  },
  '/demo/music/Artist B/starlight.mp3': {
    integratedLufs: -16.8,
    truePeakDb: -0.9,
    lraLu: 9.6,
    lraLowLufs: -24.3,
  },
  '/demo/music/Classics/Rock/track1.mp3': {
    integratedLufs: -11.5,
    truePeakDb: -0.4,
    lraLu: 6.2,
    lraLowLufs: -17.8,
  },
  '/demo/music/demo-track.mp3': {
    integratedLufs: -19.4,
    truePeakDb: -2.3,
    lraLu: 10.0,
    lraLowLufs: -28.7,
  },
};

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/$/, '') || '/';
}

function findDemoAudioFile(path: string) {
  const key = normalizePath(path);
  return DEMO_AUDIO_FILES.find((file) => normalizePath(file.path) === key);
}

export function hasDemoLoudnessProfile(path: string): boolean {
  return normalizePath(path) in DEMO_LOUDNESS_PROFILES;
}

export function getDemoLoudnessProfile(path: string): DemoLoudnessProfile | null {
  const key = normalizePath(path);
  return DEMO_LOUDNESS_PROFILES[key] ?? null;
}

export function resolveDemoAnalyzeTargetLufs(
  targetLufs: unknown,
): { ok: true; targetLufs: number } | { ok: false; error: string } {
  let resolved = DEFAULT_LOUDNESS_TARGET_LUFS;
  if (typeof targetLufs === 'number' && Number.isFinite(targetLufs)) {
    if (targetLufs < MIN_TARGET_LUFS || targetLufs > MAX_TARGET_LUFS) {
      return {
        ok: false,
        error: `targetLufs must be between ${MIN_TARGET_LUFS} and ${MAX_TARGET_LUFS}`,
      };
    }
    resolved = targetLufs;
  }
  return { ok: true, targetLufs: resolved };
}

export function analyzeDemoLoudness(
  path: string,
  targetLufs: number,
): LoudnessAnalyzeResult | null {
  const profile = getDemoLoudnessProfile(path);
  if (!profile) {
    return null;
  }

  const trackGainDb = computeAutoGainDb(profile.integratedLufs, profile.truePeakDb, targetLufs);

  return {
    status: 'ok',
    integratedLufs: profile.integratedLufs,
    lraLowLufs: profile.lraLowLufs,
    lraLu: profile.lraLu,
    truePeakDb: profile.truePeakDb,
    trackGainDb,
    fileMtime: DEMO_AUDIO_FILE_MTIME_MS,
    algorithmVersion: LOUDNESS_ALGORITHM_VERSION,
  };
}

export function statDemoAudioFile(path: string): AudioFileStat | null {
  const file = findDemoAudioFile(path);
  if (!file) {
    return null;
  }

  return {
    mtimeMs: DEMO_AUDIO_FILE_MTIME_MS,
    size: file.size,
  };
}

export function handleDemoAnalyzeLoudness(payload: unknown): IPCResponse<LoudnessAnalyzeResult> {
  const path =
    typeof payload === 'object' &&
    payload !== null &&
    'path' in payload &&
    typeof (payload as { path: unknown }).path === 'string'
      ? (payload as { path: string }).path
      : '';

  if (!path || !isDemoAudioFilePath(path)) {
    return {
      success: false,
      error: 'Path is not an audio file',
    };
  }

  if (!findDemoAudioFile(path)) {
    return {
      success: false,
      error: `Path not found: ${normalizePath(path)}`,
    };
  }

  if (!hasDemoLoudnessProfile(path)) {
    return {
      success: false,
      error: `No loudness profile for path: ${normalizePath(path)}`,
    };
  }

  const target = resolveDemoAnalyzeTargetLufs(
    typeof payload === 'object' && payload !== null && 'targetLufs' in payload
      ? (payload as { targetLufs: unknown }).targetLufs
      : undefined,
  );
  if (!target.ok) {
    return {
      success: false,
      error: target.error,
    };
  }

  const data = analyzeDemoLoudness(path, target.targetLufs);
  if (!data) {
    return {
      success: false,
      error: `No loudness profile for path: ${normalizePath(path)}`,
    };
  }

  return {
    success: true,
    data,
  };
}

export function handleDemoStatAudioFile(payload: unknown): IPCResponse<AudioFileStat> {
  const path =
    typeof payload === 'object' &&
    payload !== null &&
    'path' in payload &&
    typeof (payload as { path: unknown }).path === 'string'
      ? (payload as { path: string }).path
      : '';

  if (!path || !isDemoAudioFilePath(path)) {
    return {
      success: false,
      error: 'Path is not an audio file',
    };
  }

  const stat = statDemoAudioFile(path);
  if (!stat) {
    return {
      success: false,
      error: `Path not found: ${normalizePath(path)}`,
    };
  }

  return {
    success: true,
    data: stat,
  };
}
