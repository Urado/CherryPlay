import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { app } from 'electron';
import ffmpegStaticPath from 'ffmpeg-static';

import {
  DEFAULT_TARGET_LUFS,
  HEADROOM_DB_TP,
  LOUDNESS_ALGORITHM_VERSION,
  computeAutoGainDb,
  type LoudnessScanError,
  type LoudnessScanResult,
} from '../../src/shared/contracts/loudness.js';
import { normalizeStatNumber } from '../utils/fsHelpers.js';

export {
  DEFAULT_LOUDNESS_TARGET_LUFS,
  DEFAULT_TARGET_LUFS,
  HEADROOM_DB_TP,
  LOUDNESS_ALGORITHM_VERSION,
  MAX_TARGET_LUFS,
  MIN_TARGET_LUFS,
  type LoudnessScanError,
  type LoudnessScanOk,
  type LoudnessScanResult,
} from '../../src/shared/contracts/loudness.js';

const FFMPEG_MIN_TIMEOUT_MS = 2 * 60 * 1000;
const FFMPEG_MAX_TIMEOUT_MS = 10 * 60 * 1000;
const FFMPEG_MS_PER_MB = 15_000;
const FFMPEG_BASE_TIMEOUT_MS = 60_000;

const MIN_INTEGRATED_LUFS = -70;
const MAX_INTEGRATED_LUFS = 10;
const MIN_TRUE_PEAK_DB = -60;
const MAX_TRUE_PEAK_DB = 10;

export type AnalyzeLoudnessOptions = {
  /** When provided, skips an extra fs.stat for mtime (e.g. from IPC validation). */
  fileMtime?: number;
  /** Used to scale FFmpeg timeout; optional but recommended when known. */
  fileSizeBytes?: number;
};

export type Ebur128ParseResult = {
  integratedLufs: number;
  lraLowLufs?: number;
  lraLu?: number;
  truePeakDb: number;
};

let scanQueue: Promise<unknown> = Promise.resolve();

function isFiniteInRange(value: number, min: number, max: number): boolean {
  return Number.isFinite(value) && value >= min && value <= max;
}

function parseTpkPeakValues(tpkValues: string): number | null {
  const peaks = tpkValues
    .trim()
    .split(/\s+/)
    .map((value) => Number.parseFloat(value))
    .filter((value) => Number.isFinite(value));
  return peaks.length > 0 ? Math.max(...peaks) : null;
}

/**
 * Prefer dBTP (true peak) over dBFS (sample peak) when FFmpeg reports both.
 */
function parseTruePeakDb(searchText: string): number | null {
  const peakDbtpMatch = searchText.match(/Peak:\s*([-\d.]+)\s+dBTP/i);
  if (peakDbtpMatch) {
    return Number.parseFloat(peakDbtpMatch[1]);
  }

  const peakDbfsMatch = searchText.match(/Peak:\s*([-\d.]+)\s+dBFS/i);
  if (peakDbfsMatch) {
    return Number.parseFloat(peakDbfsMatch[1]);
  }

  const tpkDbtpMatch = searchText.match(/TPK:\s*(.+?)\s+dBTP/i);
  if (tpkDbtpMatch) {
    return parseTpkPeakValues(tpkDbtpMatch[1]);
  }

  const tpkDbfsMatch = searchText.match(/TPK:\s*(.+?)\s+dBFS/i);
  if (tpkDbfsMatch) {
    return parseTpkPeakValues(tpkDbfsMatch[1]);
  }

  return null;
}

function computeFfmpegTimeoutMs(fileSizeBytes?: number): number {
  if (!fileSizeBytes || fileSizeBytes <= 0) {
    return FFMPEG_MAX_TIMEOUT_MS;
  }

  const sizeMb = fileSizeBytes / (1024 * 1024);
  const scaledTimeout = FFMPEG_BASE_TIMEOUT_MS + sizeMb * FFMPEG_MS_PER_MB;
  return Math.min(
    FFMPEG_MAX_TIMEOUT_MS,
    Math.max(FFMPEG_MIN_TIMEOUT_MS, Math.round(scaledTimeout)),
  );
}

/**
 * Parse integrated LUFS and true peak from FFmpeg ebur128 stderr (Summary section).
 */
export function parseEbur128Summary(stderr: string): Ebur128ParseResult | null {
  const summaryIndex = stderr.lastIndexOf('Summary:');
  const searchText = summaryIndex >= 0 ? stderr.slice(summaryIndex) : stderr;

  let integratedLufs: number | null = null;

  const summaryIntegratedMatch = searchText.match(
    /Integrated loudness:\s*\r?\n\s*I:\s*([-\d.]+)\s+LUFS/i,
  );
  if (summaryIntegratedMatch) {
    integratedLufs = Number.parseFloat(summaryIntegratedMatch[1]);
  } else {
    const streamingMatches = [...stderr.matchAll(/\bI:\s*([-\d.]+)\s+LUFS/gi)];
    if (streamingMatches.length > 0) {
      integratedLufs = Number.parseFloat(streamingMatches[streamingMatches.length - 1][1]);
    }
  }

  if (
    integratedLufs === null ||
    !isFiniteInRange(integratedLufs, MIN_INTEGRATED_LUFS, MAX_INTEGRATED_LUFS)
  ) {
    return null;
  }

  const truePeakDb = parseTruePeakDb(searchText);

  if (truePeakDb === null || !isFiniteInRange(truePeakDb, MIN_TRUE_PEAK_DB, MAX_TRUE_PEAK_DB)) {
    return null;
  }

  let lraLu: number | undefined;
  const lraMatch = searchText.match(/Loudness range:\s*[\s\S]*?\bLRA:\s*([-\d.]+)\s+LU\b/i);
  if (lraMatch) {
    const parsedLra = Number.parseFloat(lraMatch[1]);
    if (Number.isFinite(parsedLra) && parsedLra >= 0 && parsedLra <= 50) {
      lraLu = parsedLra;
    }
  }

  let lraLowLufs: number | undefined;
  const lraLowMatch = searchText.match(/\bLRA low:\s*([-\d.]+)\s+LUFS\b/i);
  if (lraLowMatch) {
    const parsedLraLow = Number.parseFloat(lraLowMatch[1]);
    if (isFiniteInRange(parsedLraLow, MIN_INTEGRATED_LUFS, MAX_INTEGRATED_LUFS)) {
      lraLowLufs = parsedLraLow;
    }
  }

  return { integratedLufs, lraLowLufs, lraLu, truePeakDb };
}

/**
 * Compute per-track gain in dB with −1 dBTP headroom cap.
 * @deprecated Prefer {@link computeAutoGainDb} from contracts — kept for existing imports.
 */
export function computeTrackGainDb(
  integratedLufs: number,
  truePeakDb: number,
  targetLufs: number,
  headroomDbTp: number = HEADROOM_DB_TP,
): number {
  return computeAutoGainDb(integratedLufs, truePeakDb, targetLufs, headroomDbTp);
}

function getFfmpegCandidatePaths(): string[] {
  const candidates: string[] = [];

  if (typeof ffmpegStaticPath === 'string' && ffmpegStaticPath.length > 0) {
    candidates.push(ffmpegStaticPath);
    if (app.isPackaged) {
      candidates.push(ffmpegStaticPath.replace('app.asar', 'app.asar.unpacked'));
    }
  }

  if (app.isPackaged) {
    const executableName = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
    candidates.push(path.join(process.resourcesPath, 'ffmpeg-static', executableName));
  }

  return [...new Set(candidates)];
}

/**
 * Resolve bundled ffmpeg binary path (dev, asar-unpacked, or extraResources).
 */
export function resolveFfmpegPath(): string | null {
  return getFfmpegCandidatePaths().find((candidatePath) => fs.existsSync(candidatePath)) ?? null;
}

function runFfmpegEbur128(
  ffmpegPath: string,
  filePath: string,
  fileSizeBytes?: number,
): Promise<{ stderr: string; exitCode: number | null }> {
  return new Promise((resolve, reject) => {
    const args = [
      '-hide_banner',
      '-nostats',
      '-i',
      filePath,
      '-af',
      'ebur128=peak=true',
      '-f',
      'null',
      '-',
    ];

    const child = spawn(ffmpegPath, args, {
      windowsHide: true,
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    let stderr = '';
    let settled = false;

    const timeoutMs = computeFfmpegTimeoutMs(fileSizeBytes);
    const timeoutId = setTimeout(() => {
      if (settled) {
        return;
      }
      child.kill();
      settled = true;
      reject(new Error(`FFmpeg loudness scan timed out after ${Math.round(timeoutMs / 1000)}s`));
    }, timeoutMs);

    child.stderr?.on('data', (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeoutId);
      reject(error);
    });

    child.on('close', (exitCode) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeoutId);
      resolve({ stderr, exitCode });
    });
  });
}

function enqueueScan<T>(task: () => Promise<T>): Promise<T> {
  const run = scanQueue.then(() => task());
  scanQueue = run.catch(() => undefined);
  return run;
}

function scanError(message: string): LoudnessScanError {
  return { status: 'error', errorMessage: message };
}

/**
 * Analyze loudness for a local audio file using FFmpeg ebur128.
 */
export async function analyzeLoudness(
  filePath: string,
  targetLufs: number = DEFAULT_TARGET_LUFS,
  options?: AnalyzeLoudnessOptions,
): Promise<LoudnessScanResult> {
  return enqueueScan(async () => {
    const ffmpegPath = resolveFfmpegPath();
    if (!ffmpegPath) {
      return scanError('FFmpeg binary not found. Ensure ffmpeg-static is installed and bundled.');
    }

    let fileMtime: number;
    if (options?.fileMtime !== undefined) {
      fileMtime = options.fileMtime;
    } else {
      try {
        const stats = await fs.promises.stat(filePath);
        fileMtime = normalizeStatNumber(stats.mtimeMs);
      } catch (error) {
        return scanError(`Failed to read file metadata: ${(error as Error).message}`);
      }
    }

    try {
      const { stderr, exitCode } = await runFfmpegEbur128(
        ffmpegPath,
        filePath,
        options?.fileSizeBytes,
      );

      if (exitCode !== 0) {
        const trimmed = stderr.trim();
        const tail = trimmed.length > 400 ? trimmed.slice(-400) : trimmed;
        return scanError(
          tail.length > 0
            ? `FFmpeg exited with code ${exitCode}: ${tail}`
            : `FFmpeg exited with code ${exitCode ?? 'unknown'}`,
        );
      }

      const parsed = parseEbur128Summary(stderr);
      if (!parsed) {
        return scanError('Failed to parse ebur128 measurement output from FFmpeg stderr');
      }

      const trackGainDb = computeTrackGainDb(parsed.integratedLufs, parsed.truePeakDb, targetLufs);

      return {
        status: 'ok',
        integratedLufs: parsed.integratedLufs,
        lraLowLufs: parsed.lraLowLufs,
        lraLu: parsed.lraLu,
        truePeakDb: parsed.truePeakDb,
        trackGainDb,
        fileMtime,
        algorithmVersion: LOUDNESS_ALGORITHM_VERSION,
      };
    } catch (error) {
      return scanError(`Loudness scan failed: ${(error as Error).message}`);
    }
  });
}
