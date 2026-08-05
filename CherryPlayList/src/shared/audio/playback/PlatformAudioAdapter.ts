import type { LoudnessAnalyzeResult } from '../../contracts/loudness';
import type { AudioFileStat } from '../../platform/types';

import type { PlaybackSource } from './types';

/**
 * Result of resolving a {@link PlaybackSource} to a URL the runtime can play.
 */
export interface ResolvedPlaybackUrl {
  /** Playable URL (object URL, http(s), file URL, etc.). */
  readonly url: string;
  /** Optional cleanup when the URL is no longer needed (e.g. revoke object URL). */
  readonly revoke?: () => void;
}

/**
 * Platform port for audio I/O beneath {@link PlaybackEngine}.
 *
 * Electron delegates to IPC (`audio:getFileUrl` → `cherryplay-audio://`, `audio:getDuration`);
 * Capacitor/native methods are reserved for Stage 1 (see `android-capacitor-brief.md`).
 * Web demo may stub or use fetch-based resolution.
 *
 * Device selection (`setSinkId`) stays here — not in stores after migration.
 */
export interface PlatformAudioAdapter {
  /**
   * Resolves an abstract source to a playable URL.
   * @param source - Discriminated {@link PlaybackSource}.
   */
  resolveSource(source: PlaybackSource): Promise<ResolvedPlaybackUrl>;

  /**
   * Optional duration lookup by file path (IPC / native plugin).
   * @param filePath - Absolute or project-relative path.
   * @returns Duration in seconds, or `null` if unknown.
   */
  getDuration?(filePath: string): Promise<number | null>;

  /**
   * Measures integrated loudness and true peak via platform scanner (Electron IPC).
   */
  analyzeLoudness?(filePath: string, targetLufs: number): Promise<LoudnessAnalyzeResult | null>;

  /**
   * Returns audio file metadata for staleness checks (`mtimeMs`, `size`).
   */
  statAudioFile?(filePath: string): Promise<AudioFileStat | null>;

  /**
   * Routes output to the given device on an HTML element or Web Audio context.
   * @param target - `HTMLAudioElement` today; `AudioContext` for Web Audio backends.
   * @param deviceId - Device id or `null` for system default.
   */
  setSinkId(target: HTMLAudioElement | AudioContext, deviceId: string | null): Promise<void>;
}
