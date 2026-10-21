import * as path from 'path';

type Entry = { type: 'directory' } | { type: 'file'; content: string };
type Handler = (event: { sender: { send: jest.Mock } }, payload: unknown) => Promise<unknown>;

const entries = new Map<string, Entry>();
const handlers = new Map<string, Handler>();
const handle = jest.fn((channel: string, callback: Handler) => handlers.set(channel, callback));
const resolvePath = (value: string): string => path.resolve(value);

const addDirectory = (value: string): void => {
  const target = resolvePath(value);
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
  entries.set(resolvePath(value), { type: 'file', content });
};

const missing = (value: string): Error & { code: string } =>
  Object.assign(new Error(`ENOENT: ${value}`), { code: 'ENOENT' });

const run = <T>(operation: () => T): Promise<T> => {
  try {
    return Promise.resolve(operation());
  } catch (error) {
    return Promise.reject(error instanceof Error ? error : new Error(String(error)));
  }
};

const filesystem = {
  access: jest.fn((value: string) =>
    run(() => {
      if (!entries.has(resolvePath(value))) throw missing(value);
    }),
  ),
  mkdir: jest.fn((value: string) => run(() => addDirectory(value))),
  stat: jest.fn((value: string) =>
    run(() => {
      const entry = entries.get(resolvePath(value));
      if (!entry) throw missing(value);
      return {
        isDirectory: () => entry.type === 'directory',
        isFile: () => entry.type === 'file',
      };
    }),
  ),
  lstat: jest.fn((value: string) =>
    run(() => {
      const entry = entries.get(resolvePath(value));
      if (!entry) throw missing(value);
      return {
        isDirectory: () => entry.type === 'directory',
        isFile: () => entry.type === 'file',
        isSymbolicLink: () => false,
      };
    }),
  ),
  copyFile: jest.fn((source: string, destination: string) =>
    run(() => {
      const entry = entries.get(resolvePath(source));
      if (!entry || entry.type !== 'file') throw missing(source);
      addFile(destination, entry.content);
    }),
  ),
  readFile: jest.fn((value: string) =>
    run(() => {
      const entry = entries.get(resolvePath(value));
      if (!entry || entry.type !== 'file') throw missing(value);
      return entry.content;
    }),
  ),
  writeFile: jest.fn((value: string, content: string) => run(() => addFile(value, content))),
  rename: jest.fn((source: string, destination: string) =>
    run(() => {
      const sourcePath = resolvePath(source);
      const destinationPath = resolvePath(destination);
      const moving = [...entries.entries()].filter(
        ([entryPath]) =>
          entryPath === sourcePath || entryPath.startsWith(`${sourcePath}${path.sep}`),
      );
      if (moving.length === 0) throw missing(source);
      addDirectory(path.dirname(destinationPath));
      for (const [entryPath] of moving) entries.delete(entryPath);
      for (const [entryPath, entry] of moving) {
        const remainder = path.relative(sourcePath, entryPath);
        entries.set(remainder ? path.join(destinationPath, remainder) : destinationPath, entry);
      }
    }),
  ),
  rm: jest.fn((value: string) =>
    run(() => {
      const target = resolvePath(value);
      for (const entryPath of [...entries.keys()]) {
        if (entryPath === target || entryPath.startsWith(`${target}${path.sep}`))
          entries.delete(entryPath);
      }
    }),
  ),
};

jest.mock('fs/promises', () => filesystem);
jest.mock('electron', () => ({
  ipcMain: { handle: (channel: string, callback: Handler) => handle(channel, callback) },
}));

import { registerProjectHandlers } from '../../electron/ipc/project';

describe('portable package audio across main playlist and collections', () => {
  const testRoot = path.resolve(
    __dirname,
    '../../../artifacts/local-validation/cp126-all-audio-layers',
  );

  beforeEach(() => {
    entries.clear();
    handlers.clear();
    handle.mockClear();
    addDirectory(path.join(testRoot, 'packages'));
    registerProjectHandlers();
  });

  it('copies and rewrites both main playlist and collection audio in one package save', async () => {
    const mainSource = path.join(testRoot, 'source', 'main.mp3');
    const collectionSource = path.join(testRoot, 'source', 'collection.mp3');
    addFile(mainSource, 'main-audio');
    addFile(collectionSource, 'collection-audio');
    const projectFile = {
      version: '2.1',
      name: 'All audio layers',
      items: [{ type: 'track', id: 'main-track', path: mainSource, name: 'Main track' }],
      rootItems: ['main-track'],
      settings: {
        defaultPauseBetweenTracks: 0,
        defaultActionAfterTrack: 'next',
        plannedEndTime: null,
      },
      trackSettings: {},
      groupSettings: {},
      collections: [
        {
          id: 'collection-one',
          name: 'Chill',
          items: [
            {
              type: 'track',
              id: 'collection-track',
              path: collectionSource,
              name: 'Collection track',
            },
          ],
          rootItems: ['collection-track'],
        },
      ],
    };

    const response = (await handlers.get('project:savePortableAs')?.(
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
    const collectionFolder = path.join(
      response.data!.folderPath,
      'collections',
      'Chill--collection-one',
    );
    expect(entries.get(path.join(collectionFolder, 'collection.mp3'))).toEqual({
      type: 'file',
      content: 'collection-audio',
    });
    const saved = JSON.parse(
      entries.get(response.data!.cherryPath)?.type === 'file'
        ? (entries.get(response.data!.cherryPath) as { type: 'file'; content: string }).content
        : '',
    ) as typeof projectFile;
    expect(saved.items[0].path).toBe('./tracks/main.mp3');
    expect(saved.collections[0].items[0].path).toBe(
      './collections/Chill--collection-one/collection.mp3',
    );
  });
});
