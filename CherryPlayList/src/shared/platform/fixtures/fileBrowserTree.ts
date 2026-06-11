import type { DirectoryItem } from '../types';

import { DEMO_AUDIO_FILES } from './trackPaths';

export const DEMO_MUSIC_ROOT = '/demo/music';

const ARTIST_A = `${DEMO_MUSIC_ROOT}/Artist A`;
const ARTIST_A_ALBUM = `${ARTIST_A}/Album One`;
const ARTIST_B = `${DEMO_MUSIC_ROOT}/Artist B`;
const CLASSICS = `${DEMO_MUSIC_ROOT}/Classics`;
const CLASSICS_ROCK = `${CLASSICS}/Rock`;

function audioEntry(fileName: string, parentPath: string): DirectoryItem {
  const file = DEMO_AUDIO_FILES.find((f) => f.fileName === fileName);
  const path = file?.path ?? `${parentPath}/${fileName}`;
  return {
    name: fileName,
    path,
    isDirectory: false,
    size: file?.size ?? 4_096,
  };
}

const DIRECTORY_CONTENTS: Record<string, DirectoryItem[]> = {
  [DEMO_MUSIC_ROOT]: [
    { name: 'Artist A', path: ARTIST_A, isDirectory: true },
    { name: 'Artist B', path: ARTIST_B, isDirectory: true },
    { name: 'Classics', path: CLASSICS, isDirectory: true },
    audioEntry('demo-track.mp3', DEMO_MUSIC_ROOT),
  ],
  [ARTIST_A]: [
    { name: 'Album One', path: ARTIST_A_ALBUM, isDirectory: true },
    audioEntry('loose-single.mp3', ARTIST_A),
  ],
  [ARTIST_A_ALBUM]: [
    audioEntry('morning-light.mp3', ARTIST_A_ALBUM),
    audioEntry('evening-echo.mp3', ARTIST_A_ALBUM),
  ],
  [ARTIST_B]: [audioEntry('starlight.mp3', ARTIST_B)],
  [CLASSICS]: [{ name: 'Rock', path: CLASSICS_ROCK, isDirectory: true }],
  [CLASSICS_ROCK]: [audioEntry('track1.mp3', CLASSICS_ROCK)],
};

const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.flac', '.m4a', '.ogg'];

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/$/, '') || '/';
}

export function listDemoDirectory(path: string): DirectoryItem[] {
  const key = normalizePath(path);
  if (key === '' || key === '/') {
    return [
      {
        name: 'music',
        path: DEMO_MUSIC_ROOT,
        isDirectory: true,
      },
    ];
  }
  return DIRECTORY_CONTENTS[key] ?? [];
}

export function statDemoPath(path: string): {
  size: number;
  modified: number;
  isDirectory: boolean;
} | null {
  const key = normalizePath(path);
  if (key === '' || key === '/') {
    return { size: 0, modified: 0, isDirectory: true };
  }

  for (const entries of Object.values(DIRECTORY_CONTENTS)) {
    const entry = entries.find((item) => normalizePath(item.path) === key);
    if (entry) {
      return {
        size: entry.size ?? 0,
        modified: Date.now(),
        isDirectory: entry.isDirectory,
      };
    }
  }

  const knownAudio = DEMO_AUDIO_FILES.find((file) => normalizePath(file.path) === key);
  if (knownAudio) {
    return { size: knownAudio.size, modified: Date.now(), isDirectory: false };
  }

  if (AUDIO_EXTENSIONS.some((ext) => key.toLowerCase().endsWith(ext))) {
    return { size: 4_096, modified: Date.now(), isDirectory: false };
  }

  if (DIRECTORY_CONTENTS[key]) {
    return { size: 0, modified: Date.now(), isDirectory: true };
  }

  return null;
}

export function findDemoAudioFilesRecursive(path: string): string[] {
  const key = normalizePath(path);
  const results: string[] = [];

  const walk = (dirPath: string) => {
    for (const item of listDemoDirectory(dirPath)) {
      if (item.isDirectory) {
        walk(item.path);
      } else if (AUDIO_EXTENSIONS.some((ext) => item.path.toLowerCase().endsWith(ext))) {
        results.push(item.path);
      }
    }
  };

  walk(key === '/' ? DEMO_MUSIC_ROOT : key);
  return results;
}

export { resolveDemoPathForFile, resolveDemoPathForFileName } from './trackPaths';
