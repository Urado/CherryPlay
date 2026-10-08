import * as fs from 'fs/promises';
import * as path from 'path';

type ProjectIpcEvent = { sender: { send: jest.Mock } };
type ProjectIpcHandler = (event: ProjectIpcEvent, payload: unknown) => Promise<unknown>;

const handlers = new Map<string, ProjectIpcHandler>();
const handleMock = jest.fn((channel: string, handler: ProjectIpcHandler) => {
  handlers.set(channel, handler);
});

jest.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: ProjectIpcHandler) => handleMock(channel, handler),
  },
}));

import { registerProjectHandlers } from '../../electron/ipc/project';

describe('portable project Save As IPC', () => {
  const testRoot = path.join(process.cwd(), '.tmp-project-ipc-tests');
  let parentPath: string;

  beforeEach(async () => {
    handlers.clear();
    handleMock.mockClear();
    await fs.rm(testRoot, { recursive: true, force: true });
    parentPath = path.join(testRoot, 'packages');
    await fs.mkdir(parentPath, { recursive: true });
    registerProjectHandlers();
  });

  afterEach(async () => {
    await fs.rm(testRoot, { recursive: true, force: true });
  });

  const projectFile = (trackPath: string) => ({
    version: '2.0' as const,
    name: 'Portable project',
    items: [
      {
        type: 'track' as const,
        id: 'missing-track',
        path: trackPath,
        name: 'Missing track',
        duration: 30,
      },
    ],
    rootItems: ['missing-track'],
    settings: {
      defaultPauseBetweenTracks: 0,
      defaultActionAfterTrack: 'next',
      plannedEndTime: null,
    },
    trackSettings: {},
    groupSettings: {},
  });

  it('aborts the package and removes staging when a source track is missing', async () => {
    const savePortableAs = handlers.get('project:savePortableAs');
    const response = (await savePortableAs?.(
      { sender: { send: jest.fn() } },
      { parentPath, projectFile: projectFile('./tracks/missing.mp3') },
    )) as { success: boolean; error?: string };

    expect(response.success).toBe(false);
    expect(response.error).toContain('файл на диске не найден');
    expect(await fs.readdir(parentPath)).toEqual([]);
  });

  it('keeps an existing destination package unchanged when its name conflicts', async () => {
    const finalPath = path.join(parentPath, 'Portable project');
    await fs.mkdir(finalPath);
    await fs.writeFile(path.join(finalPath, 'keep.txt'), 'keep');
    const savePortableAs = handlers.get('project:savePortableAs');
    const response = (await savePortableAs?.(
      { sender: { send: jest.fn() } },
      { parentPath, projectFile: projectFile('./tracks/missing.mp3') },
    )) as { success: boolean; error?: string };

    expect(response).toEqual({
      success: false,
      error: 'Папка с таким именем уже существует',
    });
    expect(await fs.readdir(parentPath)).toEqual(['Portable project']);
    expect(await fs.readFile(path.join(finalPath, 'keep.txt'), 'utf8')).toBe('keep');
  });
});
