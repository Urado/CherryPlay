export const DEMO_AUDIO_EXTENSIONS = ['.mp3', '.wav', '.flac', '.m4a', '.ogg'] as const;

export const DEMO_AUDIO_FILE_MTIME_MS = Date.UTC(2026, 0, 1, 12, 0, 0);

export function isDemoAudioFilePath(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/').toLowerCase();
  return DEMO_AUDIO_EXTENSIONS.some((ext) => normalized.endsWith(ext));
}
