import type { ProjectItem } from '../../../src/core/types/project';
import { projectService } from '../../../src/shared/services/projectService';
import { ensureProjectStore, removeProjectStore } from '../../../src/shared/stores/projectStoreFactory';

const mockInvoke = jest.fn();
const mockStatFile = jest.fn();

jest.mock('../../../src/shared/services/ipcService', () => ({
  ipcService: {
    invoke: (...args: unknown[]) => Promise.resolve(mockInvoke(...args)),
    statFile: (...args: unknown[]) => Promise.resolve(mockStatFile(...args)),
  },
}));

describe('project service serialization', () => {
  const workspaceId = 'project-service-validation-test' as never;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    removeProjectStore(workspaceId);
  });

  const items: ProjectItem[] = [
    {
      id: 'group-root',
      name: 'Warmup',
      items: [
        {
          id: 'group-nested',
          name: 'Indie',
          items: [
            { id: 'track-1', path: 'D:/music/song.mp3', name: 'Song', duration: 185 },
          ],
        },
      ],
    },
  ];

  it('round-trips nested items, party binding, settings, and project metadata', async () => {
    const source = {
      name: 'Summer party',
      items,
      settings: {
        defaultPauseBetweenTracks: 7,
        defaultActionAfterTrack: 'pause' as const,
        plannedEndTime: 180000,
        portableMode: true,
      },
      trackSettings: new Map([['track-1', { pauseBetweenTracks: 4 }]]),
      groupSettings: new Map([['group-nested', { actionAfterTrack: 'pauseAndNext' as const }]]),
      sessionState: {
        mode: 'session' as const,
        playedTrackIds: ['track-1'],
        disabledTrackIds: [],
        disabledGroupIds: [],
        currentTrackId: 'track-1',
        sessionStartTime: 1200,
      },
      linkedParty: { id: 'party-1', shortCode: 'summer' },
      partyTrackDisplay: {
        stripLeadingCharsEnabled: true,
        stripLeadingCharsMode: 'untilDelimiter' as const,
        stripLeadingCharsCount: 3,
        stripLeadingCharsDelimiter: '|',
      },
      partyThemeId: 'neon',
      partyCustomizationSettings: { accent: '#ff00aa' },
    };

    const file = projectService.serializeProject(source);
    const loaded = await projectService.loadProjectFromData(file, '');

    expect(loaded).toEqual(source);
  });

  it('resolves relative track paths against the project folder and marks missing files', async () => {
    mockStatFile.mockImplementation((filePath: string) => {
      if (filePath === 'D:\\parties\\tracks\\present.mp3') return Promise.resolve({});
      return Promise.reject(new Error('missing'));
    });
    const file = projectService.serializeProject({
      name: 'Portable',
      items: [
        { id: 'track-present', path: './tracks/present.mp3', name: 'Present', duration: 30 },
        { id: 'track-missing', path: '.\\tracks\\missing.mp3', name: 'Missing', duration: 20 },
      ],
      settings: {
        defaultPauseBetweenTracks: 0,
        defaultActionAfterTrack: 'next',
        plannedEndTime: null,
        portableMode: true,
      },
      trackSettings: new Map(),
      groupSettings: new Map(),
    });

    const loaded = await projectService.loadProjectFromData(file, 'D:\\parties\\set.cherry');

    expect(loaded.items).toEqual([
      { id: 'track-present', path: 'D:\\parties\\tracks\\present.mp3', name: 'Present', duration: 30, isMissing: false },
      { id: 'track-missing', path: 'D:\\parties\\tracks\\missing.mp3', name: 'Missing', duration: 20, isMissing: true },
    ]);
  });

  it('rejects corrupt project data before it can be applied to the open project', async () => {
    const store = ensureProjectStore({ workspaceId, initialName: 'Playlist' });
    const currentTrack = { id: 'current-track', path: 'D:/music/current.mp3', name: 'Current', duration: 50 };
    store.getState().loadData({
      name: 'Current project',
      items: [currentTrack],
      filePath: 'D:/current.cherry',
    });
    store.getState().markAsDirty();

    await expect(projectService.loadProjectFromData({ version: 'unsupported' }, '')).rejects.toThrow(
      'Invalid project file',
    );

    expect(store.getState().name).toBe('Current project');
    expect(store.getState().items).toEqual([currentTrack]);
    expect(store.getState().meta.filePath).toBe('D:/current.cherry');
    expect(store.getState().meta.isDirty).toBe(true);
  });

  it('saves a project to the requested Save As path and exposes successful completion', async () => {
    mockInvoke.mockResolvedValue({ success: true });
    const file = projectService.serializeProject({
      name: 'Save As project',
      items: [],
      settings: {
        defaultPauseBetweenTracks: 0,
        defaultActionAfterTrack: 'next',
        plannedEndTime: null,
        portableMode: false,
      },
      trackSettings: new Map(),
      groupSettings: new Map(),
    });

    await expect(
      projectService.saveProject('D:/projects/Save As project.cherry', file, {
        notifyOnIpcError: false,
      }),
    ).resolves.toBeUndefined();

    expect(mockInvoke).toHaveBeenCalledWith(
      'project:save',
      expect.objectContaining({ path: 'D:/projects/Save As project.cherry', projectFile: file }),
      false,
    );
  });

  it('keeps a failed Save As operation rejected so callers can retain dirty state', async () => {
    mockInvoke.mockRejectedValue(new Error('disk full'));
    const file = projectService.serializeProject({
      name: 'Save As project',
      items: [],
      settings: {
        defaultPauseBetweenTracks: 0,
        defaultActionAfterTrack: 'next',
        plannedEndTime: null,
        portableMode: false,
      },
      trackSettings: new Map(),
      groupSettings: new Map(),
    });

    await expect(
      projectService.saveProject('D:/projects/Save As project.cherry', file, {
        notifyOnIpcError: false,
      }),
    ).rejects.toThrow('disk full');
  });

  it('requests portable Save As as one package operation and returns its committed paths', async () => {
    const result = {
      cherryPath: 'D:/projects/Portable/Portable.cherry',
      folderPath: 'D:/projects/Portable',
    };
    mockInvoke.mockResolvedValue(result);
    const file = projectService.serializeProject({
      name: 'Portable',
      items: [],
      settings: {
        defaultPauseBetweenTracks: 0,
        defaultActionAfterTrack: 'next',
        plannedEndTime: null,
        portableMode: true,
      },
      trackSettings: new Map(),
      groupSettings: new Map(),
    });

    await expect(
      projectService.savePortableAs('D:/projects', file, { notifyOnIpcError: false }),
    ).resolves.toEqual(result);

    expect(mockInvoke).toHaveBeenCalledWith(
      'project:savePortableAs',
      { parentPath: 'D:/projects', projectFile: file },
      false,
    );
  });

  it('propagates portable Save As failure without reporting a package path', async () => {
    mockInvoke.mockRejectedValue(new Error('source track is missing'));
    const file = projectService.serializeProject({
      name: 'Portable',
      items: [],
      settings: {
        defaultPauseBetweenTracks: 0,
        defaultActionAfterTrack: 'next',
        plannedEndTime: null,
        portableMode: true,
      },
      trackSettings: new Map(),
      groupSettings: new Map(),
    });

    await expect(
      projectService.savePortableAs('D:/projects', file, { notifyOnIpcError: false }),
    ).rejects.toThrow('source track is missing');
  });
});
