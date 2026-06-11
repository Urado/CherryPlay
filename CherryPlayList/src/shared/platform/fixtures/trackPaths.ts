/**
 * Synthetic audio paths for web demo (no binaries on disk).
 * Single source of truth for DnD path resolution and sample.cherry tracks.
 */
export interface DemoAudioFile {
  readonly fileName: string;
  readonly path: string;
  readonly size: number;
}

export const DEMO_AUDIO_FILES: readonly DemoAudioFile[] = [
  {
    fileName: 'morning-light.mp3',
    path: '/demo/music/Artist A/Album One/morning-light.mp3',
    size: 4_200_000,
  },
  {
    fileName: 'evening-echo.mp3',
    path: '/demo/music/Artist A/Album One/evening-echo.mp3',
    size: 3_800_000,
  },
  {
    fileName: 'loose-single.mp3',
    path: '/demo/music/Artist A/loose-single.mp3',
    size: 2_900_000,
  },
  {
    fileName: 'starlight.mp3',
    path: '/demo/music/Artist B/starlight.mp3',
    size: 5_100_000,
  },
  {
    fileName: 'track1.mp3',
    path: '/demo/music/Classics/Rock/track1.mp3',
    size: 5_000,
  },
  {
    fileName: 'demo-track.mp3',
    path: '/demo/music/demo-track.mp3',
    size: 12_345,
  },
] as const;

const pathByFileName = new Map<string, string>(
  DEMO_AUDIO_FILES.map((file) => [file.fileName.toLowerCase(), file.path]),
);

const pathByBaseName = new Map<string, string>(
  DEMO_AUDIO_FILES.map((file) => {
    const base = file.path.split('/').pop() ?? file.fileName;
    return [base.toLowerCase(), file.path];
  }),
);

function normalizeLookupKey(fileName: string): string {
  return fileName.trim().toLowerCase();
}

export function getDemoTrackPathByFileName(fileName: string): string | undefined {
  const key = normalizeLookupKey(fileName);
  return pathByFileName.get(key) ?? pathByBaseName.get(key);
}

export function resolveDemoPathForFileName(fileName: string): string {
  const known = getDemoTrackPathByFileName(fileName);
  if (known) {
    return known;
  }
  return `/demo/music/${fileName}`;
}

/**
 * Maps a browser File from fixture drag-and-drop to a stable synthetic path.
 */
export function resolveDemoPathForFile(file: File): string {
  const fromName = getDemoTrackPathByFileName(file.name);
  if (fromName) {
    return fromName;
  }

  const relative = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
  if (relative) {
    const segments = relative.replace(/\\/g, '/').split('/');
    const leaf = segments[segments.length - 1];
    if (leaf) {
      const fromRelative = getDemoTrackPathByFileName(leaf);
      if (fromRelative) {
        return fromRelative;
      }
    }
  }

  const matchBySize = DEMO_AUDIO_FILES.find((entry) => entry.size === file.size);
  if (matchBySize) {
    return matchBySize.path;
  }

  return resolveDemoPathForFileName(file.name);
}

export function listDemoAudioFilePaths(): string[] {
  return DEMO_AUDIO_FILES.map((file) => file.path);
}
