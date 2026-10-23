import * as path from 'path';

type VirtualEntry = { type: 'directory' } | { type: 'file'; content: string } | { type: 'symlink' };
type IpcHandler = (event: { sender: { send: jest.Mock } }, payload: unknown) => Promise<unknown>;

const virtualEntries = new Map<string, VirtualEntry>();
const handlers = new Map<string, IpcHandler>();
const handleMock = jest.fn((channel: string, handler: IpcHandler) => {
  handlers.set(channel, handler);
});

const normalized = (filePath: string): string => path.resolve(filePath);

const addDirectory = (directory: string): void => {
  const target = normalized(directory);
  const missing: string[] = [];
  let current = target;
  while (!virtualEntries.has(current)) {
    missing.push(current);
    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }
  for (const entry of missing.reverse()) {
    virtualEntries.set(entry, { type: 'directory' });
  }
};

const addFile = (filePath: string, content: string): void => {
  const target = normalized(filePath);
  addDirectory(path.dirname(target));
  virtualEntries.set(target, { type: 'file', content });
};

const addSymlink = (filePath: string): void => {
  const target = normalized(filePath);
  addDirectory(path.dirname(target));
  virtualEntries.set(target, { type: 'symlink' });
};

const missingPathError = (filePath: string): Error & { code: string } =>
  Object.assign(new Error(`ENOENT: ${filePath}`), { code: 'ENOENT' });

const asPromise = <T>(operation: () => T): Promise<T> => {
  try {
    return Promise.resolve(operation());
  } catch (error) {
    return Promise.reject(error instanceof Error ? error : new Error(String(error)));
  }
};

const virtualFs = {
  access: jest.fn((filePath: string) => asPromise(() => {
    if (!virtualEntries.has(normalized(filePath))) {
      throw missingPathError(filePath);
    }
  })),
  mkdir: jest.fn((filePath: string, options?: { recursive?: boolean }) => asPromise(() => {
    const target = normalized(filePath);
    if (!options?.recursive && virtualEntries.has(target)) {
      throw Object.assign(new Error(`EEXIST: ${filePath}`), { code: 'EEXIST' });
    }
    addDirectory(target);
  })),
  stat: jest.fn((filePath: string) => asPromise(() => {
    const entry = virtualEntries.get(normalized(filePath));
    if (!entry) {
      throw missingPathError(filePath);
    }
    return {
      isDirectory: () => entry.type === 'directory',
      isFile: () => entry.type === 'file',
    };
  })),
  lstat: jest.fn((filePath: string) => asPromise(() => {
    const entry = virtualEntries.get(normalized(filePath));
    if (!entry) {
      throw missingPathError(filePath);
    }
    return {
      isDirectory: () => entry.type === 'directory',
      isFile: () => entry.type === 'file',
      isSymbolicLink: () => entry.type === 'symlink',
    };
  })),
  copyFile: jest.fn((sourcePath: string, destinationPath: string) => asPromise(() => {
    const source = virtualEntries.get(normalized(sourcePath));
    if (!source || source.type !== 'file') {
      throw missingPathError(sourcePath);
    }
    const destination = normalized(destinationPath);
    addDirectory(path.dirname(destination));
    virtualEntries.set(destination, { type: 'file', content: source.content });
  })),
  readdir: jest.fn((directory: string) => asPromise(() => {
    const target = normalized(directory);
    const prefix = `${target}${path.sep}`;
    const children = new Map<string, VirtualEntry['type']>();
    for (const entryPath of virtualEntries.keys()) {
      if (!entryPath.startsWith(prefix)) {
        continue;
      }
      const remainder = entryPath.slice(prefix.length);
      const childName = remainder.split(path.sep)[0];
      const childEntry = virtualEntries.get(path.join(target, childName));
      if (remainder && childEntry) {
        children.set(childName, childEntry.type);
      }
    }
    return [...children.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([name, type]) => ({
        name,
        isDirectory: () => type === 'directory',
        isFile: () => type === 'file',
      }));
  })),
  unlink: jest.fn((filePath: string) => asPromise(() => {
    const target = normalized(filePath);
    if (!virtualEntries.has(target)) {
      throw missingPathError(filePath);
    }
    virtualEntries.delete(target);
  })),
  rmdir: jest.fn((directory: string) => asPromise(() => {
    const target = normalized(directory);
    if ([...virtualEntries.keys()].some((entryPath) => entryPath.startsWith(`${target}${path.sep}`))) {
      throw Object.assign(new Error(`ENOTEMPTY: ${directory}`), { code: 'ENOTEMPTY' });
    }
    if (!virtualEntries.has(target)) {
      throw missingPathError(directory);
    }
    virtualEntries.delete(target);
  })),
  readFile: jest.fn((filePath: string, encoding?: string) => asPromise(() => {
    const entry = virtualEntries.get(normalized(filePath));
    if (!entry || entry.type !== 'file') {
      throw missingPathError(filePath);
    }
    return encoding ? entry.content : Buffer.from(entry.content);
  })),
  writeFile: jest.fn((filePath: string, content: string) => asPromise(() => {
    addFile(filePath, content);
  })),
  rename: jest.fn((sourcePath: string, destinationPath: string) => asPromise(() => {
    const source = normalized(sourcePath);
    const destination = normalized(destinationPath);
    const entriesToMove = [...virtualEntries.entries()].filter(
      ([entryPath]) => entryPath === source || entryPath.startsWith(`${source}${path.sep}`),
    );
    if (entriesToMove.length === 0) {
      throw missingPathError(sourcePath);
    }
    addDirectory(path.dirname(destination));
    for (const [entryPath] of entriesToMove) {
      virtualEntries.delete(entryPath);
    }
    for (const [entryPath, entry] of entriesToMove) {
      const suffix = path.relative(source, entryPath);
      virtualEntries.set(suffix ? path.join(destination, suffix) : destination, entry);
    }
  })),
  rm: jest.fn((filePath: string, options?: { recursive?: boolean; force?: boolean }) => asPromise(() => {
    const target = normalized(filePath);
    const matches = [...virtualEntries.keys()].filter(
      (entryPath) => entryPath === target || entryPath.startsWith(`${target}${path.sep}`),
    );
    if (matches.length === 0 && !options?.force) {
      throw missingPathError(filePath);
    }
    if (matches.length > 1 && !options?.recursive) {
      throw new Error(`EISDIR: ${filePath}`);
    }
    for (const entryPath of matches) {
      virtualEntries.delete(entryPath);
    }
  })),
};

jest.mock('fs/promises', () => virtualFs);
jest.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: IpcHandler) => handleMock(channel, handler),
  },
}));

import { registerExportHandlers } from '../../electron/ipc/export';
import { registerProjectHandlers } from '../../electron/ipc/project';

const testRoot = path.resolve(__dirname, '../../../artifacts/local-validation/cp126-electron-tests');

describe('project collection portable files', () => {
  let parentPath: string;

  beforeEach(() => {
    virtualEntries.clear();
    handlers.clear();
    handleMock.mockClear();
    parentPath = path.join(testRoot, 'packages');
    addDirectory(parentPath);
    registerProjectHandlers();
  });

  it('saves every collection under a stable folder and preserves distinct files with matching names', async () => {
    const sourceOne = path.join(testRoot, 'source-one', 'shared.mp3');
    const sourceTwo = path.join(testRoot, 'source-two', 'shared.mp3');
    addFile(sourceOne, 'one');
    addFile(sourceTwo, 'two');
    const projectFile = {
      version: '2.1',
      name: 'Portable collections',
      items: [{ type: 'track', id: 'main-track', path: sourceOne, name: 'Main track' }],
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
          id: 'warm-up-01',
          name: 'Warm / up',
          items: [
            { type: 'track', id: 'first', path: sourceOne, name: 'First' },
            { type: 'track', id: 'second', path: sourceTwo, name: 'Second' },
            { type: 'track', id: 'duplicate', path: sourceOne, name: 'Duplicate' },
          ],
          rootItems: ['first', 'second', 'duplicate'],
        },
        { id: 'empty-02', name: 'Empty', items: [], rootItems: [] },
      ],
      collectionViewState: { bindings: { windowA: 'warm-up-01' } },
    };

    const savePortableAs = handlers.get('project:savePortableAs');
    const response = (await savePortableAs?.(
      { sender: { send: jest.fn() } },
      { parentPath, projectFile },
    )) as { success: boolean; data?: { cherryPath: string; folderPath: string }; error?: string };

    expect(response.success).toBe(true);
    const savedFile = JSON.parse(virtualEntries.get(response.data!.cherryPath)!.type === 'file'
      ? (virtualEntries.get(response.data!.cherryPath) as { type: 'file'; content: string }).content
      : '') as typeof projectFile;
    const firstCollection = savedFile.collections[0];
    const collectionFolder = path.join(response.data!.folderPath, 'collections', 'Warm _ up--warm-up-01');
    expect(virtualEntries.get(path.join(collectionFolder, 'shared.mp3'))).toEqual({ type: 'file', content: 'one' });
    expect(virtualEntries.get(path.join(collectionFolder, 'shared_2.mp3'))).toEqual({ type: 'file', content: 'two' });
    expect(firstCollection.items[0].path).toBe('./collections/Warm _ up--warm-up-01/shared.mp3');
    expect(firstCollection.items[1].path).toBe('./collections/Warm _ up--warm-up-01/shared_2.mp3');
    expect(firstCollection.items[2].path).toBe(firstCollection.items[0].path);
    expect(savedFile.collections[1]).toEqual({ id: 'empty-02', name: 'Empty', items: [], rootItems: [] });
    expect(savedFile.collectionViewState).toEqual({ bindings: { windowA: 'warm-up-01' } });
  });

  it('accepts both 2.0 and 2.1 project files when loading', async () => {
    const loadProject = handlers.get('project:load');
    const base = {
      name: 'Load compatibility',
      items: [],
      rootItems: [],
      settings: {
        defaultPauseBetweenTracks: 0,
        defaultActionAfterTrack: 'next',
        plannedEndTime: null,
      },
      trackSettings: {},
      groupSettings: {},
    };
    const project20Path = path.join(testRoot, '2.0.cherry');
    const project21Path = path.join(testRoot, '2.1.cherry');
    addFile(project20Path, JSON.stringify({ ...base, version: '2.0' }));
    addFile(
      project21Path,
      JSON.stringify({
        ...base,
        version: '2.1',
        collections: [{ id: 'saved-01', name: 'Saved', items: [], rootItems: [] }],
      }),
    );
    const response20 = (await loadProject?.(
      { sender: { send: jest.fn() } },
      { path: project20Path },
    )) as { success: boolean; data?: { version: string } };
    const response21 = (await loadProject?.(
      { sender: { send: jest.fn() } },
      { path: project21Path },
    )) as { success: boolean; data?: { version: string; collections?: unknown[] } };

    expect(response20.success).toBe(true);
    expect(response20.data?.version).toBe('2.0');
    expect(response21.success).toBe(true);
    expect(response21.data?.version).toBe('2.1');
    expect(response21.data?.collections).toHaveLength(1);
  });

  it('drops invalid collection bindings while preserving valid collections and bindings', async () => {
    const loadProject = handlers.get('project:load');
    const saveProject = handlers.get('project:save');
    const projectPath = path.join(testRoot, 'stale-bindings.cherry');
    const baseProject = {
      version: '2.1',
      name: 'Binding recovery',
      items: [],
      rootItems: [],
      settings: {
        defaultPauseBetweenTracks: 0,
        defaultActionAfterTrack: 'next',
        plannedEndTime: null,
      },
      trackSettings: {},
      groupSettings: {},
      collections: [
        { id: 'valid-01', name: 'Valid one', items: [], rootItems: [] },
        { id: 'valid-02', name: 'Valid two', items: [], rootItems: [] },
      ],
      collectionViewState: {
        bindings: {
          windowA: 'valid-01',
          staleWindow: 'deleted-collection',
          '': 'valid-02',
          malformedValue: 42,
        },
      },
    };
    addFile(projectPath, JSON.stringify(baseProject));

    const loadResponse = (await loadProject?.(
      { sender: { send: jest.fn() } },
      { path: projectPath },
    )) as {
      success: boolean;
      data?: {
        collections: Array<{ id: string }>;
        collectionViewState?: { bindings: Record<string, string> };
      };
    };

    expect(loadResponse.success).toBe(true);
    expect(loadResponse.data?.collections.map((collection) => collection.id)).toEqual(['valid-01', 'valid-02']);
    expect(loadResponse.data?.collectionViewState?.bindings).toEqual({ windowA: 'valid-01' });

    const savePath = path.join(testRoot, 'normalized-bindings.cherry');
    const saveResponse = (await saveProject?.(
      { sender: { send: jest.fn() } },
      { path: savePath, projectFile: baseProject },
    )) as { success: boolean };
    const savedProject = JSON.parse(
      (virtualEntries.get(savePath) as { type: 'file'; content: string }).content,
    ) as typeof baseProject;

    expect(saveResponse.success).toBe(true);
    expect(savedProject.collections).toHaveLength(2);
    expect(savedProject.collectionViewState.bindings).toEqual({ windowA: 'valid-01' });
  });

  it('rejects unsafe collection IDs before creating a portable package', async () => {
    const savePortableAs = handlers.get('project:savePortableAs');
    const response = (await savePortableAs?.(
      { sender: { send: jest.fn() } },
      {
        parentPath,
        projectFile: {
          version: '2.1',
          name: 'Invalid collection',
          items: [],
          rootItems: [],
          settings: {
            defaultPauseBetweenTracks: 0,
            defaultActionAfterTrack: 'next',
            plannedEndTime: null,
          },
          trackSettings: {},
          groupSettings: {},
          collections: [{ id: '../outside', name: 'Bad', items: [], rootItems: [] }],
        },
      },
    )) as { success: boolean; error?: string };

    expect(response.success).toBe(false);
    expect(response.error).toBe('Invalid project format');
    expect([...virtualEntries.keys()].filter((entryPath) => entryPath.startsWith(parentPath))).toEqual([
      parentPath,
    ]);
  });

  it('rejects malformed collection items, duplicate IDs, and broken item graphs on read and write', async () => {
    const malformedCollections = [
      { id: 'bad-01', name: 'Bad', items: [{ type: 'unsupported', id: 'item', name: 'Item' }], rootItems: ['item'] },
      {
        id: 'bad-02',
        name: 'Bad',
        items: [
          { type: 'track', id: 'duplicate', path: 'audio.mp3', name: 'One' },
          { type: 'track', id: 'duplicate', path: 'audio.mp3', name: 'Two' },
        ],
        rootItems: ['duplicate'],
      },
      {
        id: 'bad-03',
        name: 'Bad',
        items: [{ type: 'group', id: 'group', name: 'Group', items: ['missing'] }],
        rootItems: ['group'],
      },
      {
        id: 'bad-04',
        name: 'Bad',
        items: [{ type: 'track', id: 'track', path: 'audio.mp3', name: 'Track' }],
        rootItems: ['missing'],
      },
      {
        id: 'bad-05',
        name: 'Bad',
        items: [
          { type: 'group', id: 'first', name: 'First', items: ['second'] },
          { type: 'group', id: 'second', name: 'Second', items: ['first'] },
        ],
        rootItems: ['first'],
      },
    ];
    const save = handlers.get('project:save');
    const load = handlers.get('project:load');
    const projectPath = path.join(testRoot, 'malformed.cherry');
    for (const collection of malformedCollections) {
      const projectFile = {
        version: '2.1',
        name: 'Malformed',
        items: [],
        rootItems: [],
        settings: { defaultPauseBetweenTracks: 0, defaultActionAfterTrack: 'next', plannedEndTime: null },
        trackSettings: {},
        groupSettings: {},
        collections: [collection],
      };
      addFile(projectPath, JSON.stringify(projectFile));
      const saveResponse = (await save?.(
        { sender: { send: jest.fn() } },
        { path: projectPath, projectFile },
      )) as { success: boolean };
      const loadResponse = (await load?.(
        { sender: { send: jest.fn() } },
        { path: projectPath },
      )) as { success: boolean };

      expect(saveResponse.success).toBe(false);
      expect(loadResponse.success).toBe(false);
    }
  });

  it('aborts before staging a package when a collection audio file is missing', async () => {
    const savePortableAs = handlers.get('project:savePortableAs');
    const response = (await savePortableAs?.(
      { sender: { send: jest.fn() } },
      {
        parentPath,
        projectFile: {
          version: '2.1',
          name: 'Missing collection audio',
          items: [],
          rootItems: [],
          settings: {
            defaultPauseBetweenTracks: 0,
            defaultActionAfterTrack: 'next',
            plannedEndTime: null,
          },
          trackSettings: {},
          groupSettings: {},
          collections: [
            {
              id: 'missing-01',
              name: 'Missing',
              items: [
                {
                  type: 'track',
                  id: 'missing',
                  path: path.join(testRoot, 'missing.mp3'),
                  name: 'Missing audio',
                },
              ],
              rootItems: ['missing'],
            },
          ],
        },
      },
    )) as { success: boolean; error?: string };

    expect(response.success).toBe(false);
    expect(response.error).toContain('файлу подборки');
    expect([...virtualEntries.keys()].filter((entryPath) => entryPath.startsWith(parentPath))).toEqual([
      parentPath,
    ]);
  });

  it('removes only obsolete referenced audio and old collection folders after an in-place save', async () => {
    const projectPath = path.join(testRoot, 'workspace', 'project.cherry');
    const oldAudioPath = path.join(testRoot, 'workspace', 'collections', 'Old name--rename-01', 'old.mp3');
    const oldProject = {
      version: '2.1',
      name: 'Workspace',
      items: [],
      rootItems: [],
      settings: {
        defaultPauseBetweenTracks: 0,
        defaultActionAfterTrack: 'next',
        plannedEndTime: null,
        portableMode: true,
      },
      trackSettings: {},
      groupSettings: {},
      collections: [
        {
          id: 'rename-01',
          name: 'Old name',
          items: [{ type: 'track', id: 'old-track', path: './collections/Old name--rename-01/old.mp3', name: 'Old' }],
          rootItems: ['old-track'],
        },
      ],
    };
    addFile(projectPath, JSON.stringify(oldProject));
    addFile(oldAudioPath, 'old');

    const save = handlers.get('project:save');
    const response = (await save?.(
      { sender: { send: jest.fn() } },
      {
        path: projectPath,
        portableMode: true,
        projectFile: {
          ...oldProject,
          collections: [{ id: 'rename-01', name: 'New name', items: [], rootItems: [] }],
        },
      },
    )) as { success: boolean; error?: string };

    expect(response.success).toBe(true);
    expect(virtualEntries.has(oldAudioPath)).toBe(false);
    expect(virtualEntries.has(path.dirname(oldAudioPath))).toBe(false);
    expect(virtualEntries.has(path.join(testRoot, 'workspace', 'collections', 'New name--rename-01'))).toBe(true);
  });

  it('rejects collection sources reached through a nested package symlink without changing the project', async () => {
    const projectPath = path.join(testRoot, 'linked-workspace', 'project.cherry');
    const collectionDir = path.join(testRoot, 'linked-workspace', 'collections', 'Safe--safe-01');
    const nestedSymlink = path.join(collectionDir, 'linked-audio');
    const symlinkAudioPath = path.join(nestedSymlink, 'track.mp3');
    const oldProjectContent = JSON.stringify({
      version: '2.1',
      name: 'Existing workspace',
      items: [],
      rootItems: [],
      settings: {
        defaultPauseBetweenTracks: 0,
        defaultActionAfterTrack: 'next',
        plannedEndTime: null,
        portableMode: true,
      },
      trackSettings: {},
      groupSettings: {},
      collections: [{ id: 'safe-01', name: 'Safe', items: [], rootItems: [] }],
    });
    addFile(projectPath, oldProjectContent);
    addDirectory(collectionDir);
    addSymlink(nestedSymlink);
    addFile(symlinkAudioPath, 'outside package audio');

    const save = handlers.get('project:save');
    const response = (await save?.(
      { sender: { send: jest.fn() } },
      {
        path: projectPath,
        portableMode: true,
        projectFile: {
          version: '2.1',
          name: 'Existing workspace',
          items: [],
          rootItems: [],
          settings: {
            defaultPauseBetweenTracks: 0,
            defaultActionAfterTrack: 'next',
            plannedEndTime: null,
            portableMode: true,
          },
          trackSettings: {},
          groupSettings: {},
          collections: [
            {
              id: 'safe-01',
              name: 'Safe',
              items: [{ type: 'track', id: 'track', path: symlinkAudioPath, name: 'Track' }],
              rootItems: ['track'],
            },
          ],
        },
      },
    )) as { success: boolean };

    expect(response.success).toBe(false);
    expect(virtualEntries.get(projectPath)).toEqual({ type: 'file', content: oldProjectContent });
    expect(virtualEntries.get(nestedSymlink)).toEqual({ type: 'symlink' });
    expect(virtualEntries.get(symlinkAudioPath)).toEqual({ type: 'file', content: 'outside package audio' });
  });

  it('rejects collection directory paths as audio files without changing the project', async () => {
    const projectPath = path.join(testRoot, 'directory-workspace', 'project.cherry');
    const collectionDir = path.join(testRoot, 'directory-workspace', 'collections', 'Safe--safe-02');
    const nestedDirectory = path.join(collectionDir, 'nested');
    const oldProjectContent = JSON.stringify({
      version: '2.1',
      name: 'Existing workspace',
      items: [],
      rootItems: [],
      settings: {
        defaultPauseBetweenTracks: 0,
        defaultActionAfterTrack: 'next',
        plannedEndTime: null,
        portableMode: true,
      },
      trackSettings: {},
      groupSettings: {},
      collections: [{ id: 'safe-02', name: 'Safe', items: [], rootItems: [] }],
    });
    addFile(projectPath, oldProjectContent);
    addDirectory(collectionDir);
    addDirectory(nestedDirectory);

    const save = handlers.get('project:save');
    for (const invalidAudioPath of [collectionDir, nestedDirectory]) {
      const response = (await save?.(
        { sender: { send: jest.fn() } },
        {
          path: projectPath,
          portableMode: true,
          projectFile: {
            version: '2.1',
            name: 'Existing workspace',
            items: [],
            rootItems: [],
            settings: {
              defaultPauseBetweenTracks: 0,
              defaultActionAfterTrack: 'next',
              plannedEndTime: null,
              portableMode: true,
            },
            trackSettings: {},
            groupSettings: {},
            collections: [
              {
                id: 'safe-02',
                name: 'Safe',
                items: [{ type: 'track', id: 'track', path: invalidAudioPath, name: 'Track' }],
                rootItems: ['track'],
              },
            ],
          },
        },
      )) as { success: boolean };

      expect(response.success).toBe(false);
      expect(virtualEntries.get(projectPath)).toEqual({ type: 'file', content: oldProjectContent });
    }
  });
});

describe('collection folder export', () => {
  beforeEach(() => {
    virtualEntries.clear();
    handlers.clear();
    handleMock.mockClear();
    registerExportHandlers();
  });

  it('copies tracks with the same basename without overwriting either file', async () => {
    const sourceOne = path.join(testRoot, 'one', 'track.mp3');
    const sourceTwo = path.join(testRoot, 'two', 'track.mp3');
    const targetPath = path.join(testRoot, 'output');
    addFile(sourceOne, 'one');
    addFile(sourceTwo, 'two');

    const copyTracks = handlers.get('export:copyTracksToFolder');
    const response = (await copyTracks?.(
      { sender: { send: jest.fn() } },
      {
        tracks: [
          { id: 'one', path: sourceOne, name: 'One' },
          { id: 'two', path: sourceTwo, name: 'Two' },
        ],
        targetPath,
        folderName: 'Collection',
      },
    )) as { success: boolean; data?: { folderPath: string; failed: unknown[] } };

    expect(response.success).toBe(true);
    expect(response.data?.failed).toEqual([]);
    expect(virtualEntries.get(path.join(response.data!.folderPath, 'track.mp3'))).toEqual({
      type: 'file',
      content: 'one',
    });
    expect(virtualEntries.get(path.join(response.data!.folderPath, 'track_2.mp3'))).toEqual({
      type: 'file',
      content: 'two',
    });
  });
});
