import * as path from 'path';

type VirtualEntry = { type: 'directory' } | { type: 'file'; content: string };
type Handler = (event: { sender: { send: jest.Mock } }, payload: unknown) => Promise<unknown>;

const entries = new Map<string, VirtualEntry>();
const handlers = new Map<string, Handler>();
const registerHandler = jest.fn((channel: string, handler: Handler) =>
  handlers.set(channel, handler),
);
const absolutePath = (value: string): string => path.resolve(value);

const addDirectory = (value: string): void => {
  const target = absolutePath(value);
  const missing: string[] = [];
  let current = target;
  while (!entries.has(current)) {
    missing.push(current);
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  for (const directory of missing.reverse()) entries.set(directory, { type: 'directory' });
};

const addFile = (value: string, content: string): void => {
  addDirectory(path.dirname(value));
  entries.set(absolutePath(value), { type: 'file', content });
};

const missing = (value: string): Error & { code: string } =>
  Object.assign(new Error(`ENOENT: ${value}`), { code: 'ENOENT' });

const asPromise = <T>(operation: () => T): Promise<T> => {
  try {
    return Promise.resolve(operation());
  } catch (error) {
    return Promise.reject(error instanceof Error ? error : new Error(String(error)));
  }
};

const fsMock = {
  access: jest.fn((value: string) =>
    asPromise(() => {
      if (!entries.has(absolutePath(value))) throw missing(value);
    }),
  ),
  mkdir: jest.fn((value: string) => asPromise(() => addDirectory(value))),
  stat: jest.fn((value: string) =>
    asPromise(() => {
      const entry = entries.get(absolutePath(value));
      if (!entry) throw missing(value);
      return { isDirectory: () => entry.type === 'directory', isFile: () => entry.type === 'file' };
    }),
  ),
  lstat: jest.fn((value: string) =>
    asPromise(() => {
      const entry = entries.get(absolutePath(value));
      if (!entry) throw missing(value);
      return {
        isDirectory: () => entry.type === 'directory',
        isFile: () => entry.type === 'file',
        isSymbolicLink: () => false,
      };
    }),
  ),
  copyFile: jest.fn((source: string, destination: string) =>
    asPromise(() => {
      const entry = entries.get(absolutePath(source));
      if (!entry || entry.type !== 'file') throw missing(source);
      addFile(destination, entry.content);
    }),
  ),
  readFile: jest.fn((value: string) =>
    asPromise(() => {
      const entry = entries.get(absolutePath(value));
      if (!entry || entry.type !== 'file') throw missing(value);
      return entry.content;
    }),
  ),
  writeFile: jest.fn((value: string, content: string) => asPromise(() => addFile(value, content))),
  rename: jest.fn((source: string, destination: string) =>
    asPromise(() => {
      const sourcePath = absolutePath(source);
      const destinationPath = absolutePath(destination);
      const moved = [...entries.entries()].filter(
        ([entryPath]) =>
          entryPath === sourcePath || entryPath.startsWith(`${sourcePath}${path.sep}`),
      );
      if (moved.length === 0) throw missing(source);
      addDirectory(path.dirname(destinationPath));
      for (const [entryPath] of moved) entries.delete(entryPath);
      for (const [entryPath, entry] of moved) {
        const remainder = path.relative(sourcePath, entryPath);
        entries.set(remainder ? path.join(destinationPath, remainder) : destinationPath, entry);
      }
    }),
  ),
  rm: jest.fn((value: string) =>
    asPromise(() => {
      const target = absolutePath(value);
      for (const entryPath of [...entries.keys()]) {
        if (entryPath === target || entryPath.startsWith(`${target}${path.sep}`))
          entries.delete(entryPath);
      }
    }),
  ),
};

jest.mock('fs/promises', () => fsMock);
jest.mock('electron', () => ({
  ipcMain: { handle: (channel: string, handler: Handler) => registerHandler(channel, handler) },
}));

import { registerProjectHandlers } from '../../electron/ipc/project';

describe('portable package main playlist audio', () => {
  const testRoot = path.resolve(
    __dirname,
    '../../../artifacts/local-validation/cp126-main-playlist-audio',
  );

  beforeEach(() => {
    entries.clear();
    handlers.clear();
    registerHandler.mockClear();
    addDirectory(path.join(testRoot, 'packages'));
    registerProjectHandlers();
  });

  it('copies the main playlist track into tracks and rewrites its saved path', async () => {
    const source = path.join(testRoot, 'source', 'main.mp3');
    addFile(source, 'main-audio');
    const projectFile = {
      version: '2.1',
      name: 'Main audio package',
      items: [{ type: 'track', id: 'main-audio-track', path: source, name: 'Main audio' }],
      rootItems: ['main-audio-track'],
      settings: {
        defaultPauseBetweenTracks: 0,
        defaultActionAfterTrack: 'next',
        plannedEndTime: null,
      },
      trackSettings: {},
      groupSettings: {},
      collections: [],
    };

    const handler = handlers.get('project:savePortableAs');
    const response = (await handler?.(
      { sender: { send: jest.fn() } },
      { parentPath: path.join(testRoot, 'packages'), projectFile },
    )) as {
      success: boolean;
      data?: { cherryPath: string; folderPath: string };
      error?: string;
    };

    expect(response.success).toBe(true);
    expect(entries.get(path.join(response.data!.folderPath, 'tracks', 'main.mp3'))).toEqual({
      type: 'file',
      content: 'main-audio',
    });
    const saved = JSON.parse(
      entries.get(response.data!.cherryPath)?.type === 'file'
        ? (entries.get(response.data!.cherryPath) as { type: 'file'; content: string }).content
        : '',
    ) as typeof projectFile;
    expect(saved.items[0].path).toBe('./tracks/main.mp3');
  });
});
