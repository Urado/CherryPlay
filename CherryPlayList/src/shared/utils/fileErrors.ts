const FILE_NOT_FOUND_MESSAGE_PATTERNS = [
  'enoent',
  'no such file',
  'file not found',
  'файл не найден',
] as const;

/** True when Node/Electron IPC or adapter reports a missing file. */
export function isFileNotFoundError(error: unknown): boolean {
  if (!error) {
    return false;
  }

  const code = (error as NodeJS.ErrnoException).code;
  if (code === 'ENOENT') {
    return true;
  }

  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return FILE_NOT_FOUND_MESSAGE_PATTERNS.some((pattern) => message.includes(pattern));
}

export function formatMissingTrackMessage(trackName: string, trackPath?: string): string {
  if (trackPath) {
    return `Файл не найден: ${trackPath}`;
  }
  return `Файл не найден: ${trackName}`;
}
