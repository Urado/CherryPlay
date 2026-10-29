import { spawn, type ChildProcess } from 'node:child_process';
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
  fileMtime?: number;
  fileSizeBytes?: number;
  requestId?: string;
};

export type Ebur128ParseResult = {
  integratedLufs: number;
  lraLowLufs?: number;
  lraLu?: number;
  truePeakDb: number;
};

type ScanTask = {
  requestId: string;
  state: 'queued' | 'running' | 'settled';
  cancelRequested: boolean;
  processFinished: boolean;
  child: ChildProcess | null;
  resolve: (result: LoudnessScanResult) => void;
  filePath: string;
  targetLufs: number;
  options?: AnalyzeLoudnessOptions;
};

const MAX_SCAN_REQUEST_ID_LENGTH = 256;
const scanQueue: ScanTask[] = [];
const scanTasks = new Map<string, ScanTask>();
let activeScan: ScanTask | null = null;
let internalRequestSequence = 0;

const isFiniteInRange = (value: number, min: number, max: number): boolean => {
  return Number.isFinite(value) && value >= min && value <= max;
};

const isInsideAsarArchive = (filePath: string): boolean => {
  return /(?:^|[/\\])app\.asar[/\\]/.test(filePath);
};

const parseTpkPeakValues = (tpkValues: string): number | null => {
  const peaks = tpkValues
    .trim()
    .split(/\s+/)
    .map((value) => Number.parseFloat(value))
    .filter((value) => Number.isFinite(value));
  return peaks.length > 0 ? Math.max(...peaks) : null;
};

const parseTruePeakDb = (searchText: string): number | null => {
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
};

const computeFfmpegTimeoutMs = (fileSizeBytes?: number): number => {
  if (!fileSizeBytes || fileSizeBytes <= 0) {
    return FFMPEG_MAX_TIMEOUT_MS;
  }

  const sizeMb = fileSizeBytes / (1024 * 1024);
  const scaledTimeout = FFMPEG_BASE_TIMEOUT_MS + sizeMb * FFMPEG_MS_PER_MB;
  return Math.min(
    FFMPEG_MAX_TIMEOUT_MS,
    Math.max(FFMPEG_MIN_TIMEOUT_MS, Math.round(scaledTimeout)),
  );
};

const isValidScanRequestId = (value: unknown): value is string => {
  return (
    typeof value === 'string' &&
    value.trim().length > 0 &&
    value.length <= MAX_SCAN_REQUEST_ID_LENGTH
  );
};

const createInternalScanRequestId = (): string => {
  let requestId = '';
  do {
    requestId = `loudness-internal-${internalRequestSequence}`;
    internalRequestSequence += 1;
  } while (scanTasks.has(requestId));
  return requestId;
};

export const parseEbur128Summary = (stderr: string): Ebur128ParseResult | null => {
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
};

export const computeTrackGainDb = (
  integratedLufs: number,
  truePeakDb: number,
  targetLufs: number,
  headroomDbTp: number = HEADROOM_DB_TP,
): number => {
  return computeAutoGainDb(integratedLufs, truePeakDb, targetLufs, headroomDbTp);
};

const getFfmpegCandidatePaths = (): string[] => {
  const candidates: string[] = [];
  const staticPath =
    typeof ffmpegStaticPath === 'string' && ffmpegStaticPath.length > 0 ? ffmpegStaticPath : null;

  if (app.isPackaged) {
    const executableName = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
    candidates.push(path.join(process.resourcesPath, 'ffmpeg-static', executableName));

    if (staticPath) {
      if (isInsideAsarArchive(staticPath)) {
        candidates.push(staticPath.replace('app.asar', 'app.asar.unpacked'));
      } else {
        candidates.push(staticPath);
      }
    }
  } else if (staticPath) {
    candidates.push(staticPath);
  }

  return [...new Set(candidates)].filter((candidatePath) => !isInsideAsarArchive(candidatePath));
};

export const resolveFfmpegPath = (): string | null => {
  return getFfmpegCandidatePaths().find((candidatePath) => fs.existsSync(candidatePath)) ?? null;
};

const runFfmpegEbur128 = (
  ffmpegPath: string,
  filePath: string,
  fileSizeBytes?: number,
  task?: ScanTask,
): Promise<{ stderr: string; exitCode: number | null }> => {
  return new Promise((resolve, reject) => {
    if (task?.cancelRequested) {
      reject(new Error('Scan cancelled'));
      return;
    }

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
    if (task) {
      task.child = child;
    }
    let stderr = '';
    let settled = false;

    const timeoutMs = computeFfmpegTimeoutMs(fileSizeBytes);
    const timeoutId = setTimeout(() => {
      if (settled) {
        return;
      }
      child.kill();
      settled = true;
      if (task) {
        task.child = null;
        task.processFinished = true;
      }
      reject(new Error(`FFmpeg loudness scan timed out after ${Math.round(timeoutMs / 1000)}s`));
    }, timeoutMs);

    const settle = (callback: () => void): void => {
      if (settled) {
        return;
      }
      settled = true;
      if (task) {
        task.child = null;
        task.processFinished = true;
      }
      clearTimeout(timeoutId);
      callback();
    };

    child.stderr?.on('data', (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      settle(() => reject(error));
    });

    child.on('close', (exitCode) => {
      settle(() => resolve({ stderr, exitCode }));
    });
  });
};

const scanError = (message: string): LoudnessScanError => {
  return { status: 'error', errorMessage: message };
};

const executeScan = async (
  task: ScanTask,
  filePath: string,
  targetLufs: number,
  options?: AnalyzeLoudnessOptions,
): Promise<LoudnessScanResult> => {
  if (task.cancelRequested) {
    return scanError('Scan cancelled');
  }

  const ffmpegPath = resolveFfmpegPath();
  if (!ffmpegPath) {
    return scanError('Не удалось проанализировать громкость этого трека.');
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

  if (task.cancelRequested) {
    return scanError('Scan cancelled');
  }

  try {
    const { stderr, exitCode } = await runFfmpegEbur128(
      ffmpegPath,
      filePath,
      options?.fileSizeBytes,
      task,
    );

    if (task.cancelRequested) {
      return scanError('Scan cancelled');
    }

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
    if (task.cancelRequested) {
      return scanError('Scan cancelled');
    }
    return scanError(`Loudness scan failed: ${(error as Error).message}`);
  }
};

const pumpScanQueue = (): void => {
  if (activeScan) {
    return;
  }

  const next = scanQueue.shift();
  if (!next) {
    return;
  }

  next.state = 'running';
  activeScan = next;
  const finish = (result: LoudnessScanResult): void => {
    next.state = 'settled';
    next.child = null;
    if (scanTasks.get(next.requestId) === next) {
      scanTasks.delete(next.requestId);
    }
    if (activeScan === next) {
      activeScan = null;
    }
    next.resolve(result);
    pumpScanQueue();
  };
  void executeScan(next, next.filePath, next.targetLufs, next.options).then(finish, (error) => {
    finish(scanError(`Loudness scan failed: ${(error as Error).message}`));
  });
};

export const analyzeLoudness = (
  filePath: string,
  targetLufs: number = DEFAULT_TARGET_LUFS,
  options?: AnalyzeLoudnessOptions,
): Promise<LoudnessScanResult> => {
  const requestId = options?.requestId ?? createInternalScanRequestId();
  if (!isValidScanRequestId(requestId)) {
    return Promise.resolve(scanError('Invalid loudness scan request ID'));
  }
  if (scanTasks.has(requestId)) {
    return Promise.resolve(scanError('Loudness scan request ID is already in use'));
  }

  return new Promise((resolve) => {
    const task: ScanTask = {
      requestId,
      state: 'queued',
      cancelRequested: false,
      processFinished: false,
      child: null,
      resolve,
      filePath,
      targetLufs,
      options,
    };
    scanTasks.set(requestId, task);
    scanQueue.push(task);
    pumpScanQueue();
  });
};

export const cancelLoudnessScan = (requestId: string): boolean => {
  if (!isValidScanRequestId(requestId)) {
    return false;
  }

  const task = scanTasks.get(requestId);
  if (!task || task.processFinished) {
    return false;
  }
  if (task.cancelRequested) {
    return true;
  }

  task.cancelRequested = true;
  if (task.state === 'queued') {
    const queuedIndex = scanQueue.indexOf(task);
    if (queuedIndex >= 0) {
      scanQueue.splice(queuedIndex, 1);
    }
    task.state = 'settled';
    if (scanTasks.get(requestId) === task) {
      scanTasks.delete(requestId);
    }
    task.resolve(scanError('Scan cancelled'));
    return true;
  }

  task.child?.kill();
  return true;
};
