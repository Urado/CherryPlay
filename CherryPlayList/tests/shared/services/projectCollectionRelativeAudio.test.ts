const mockStatFile = jest.fn();

jest.mock('../../../src/shared/services/ipcService', () => ({
  ipcService: {
    invoke: jest.fn(),
    statFile: (...args: unknown[]) => Promise.resolve(mockStatFile(...args)),
  },
}));

import { projectService } from '../../../src/shared/services/projectService';

describe('project collection relative audio loading', () => {
  beforeEach(() => {
    mockStatFile.mockReset();
    mockStatFile.mockResolvedValue({});
  });

  it('resolves collection audio relative to the project file and checks availability', async () => {
    const file = projectService.serializeProject({
      name: 'Portable set',
      items: [],
      settings: {
        defaultPauseBetweenTracks: 0,
        defaultActionAfterTrack: 'next',
        plannedEndTime: null,
        portableMode: true,
      },
      trackSettings: new Map(),
      groupSettings: new Map(),
      collections: [
        {
          id: 'relative-collection',
          name: 'Relative audio',
          items: [
            {
              id: 'relative-track',
              path: './collections/relative-collection/song.mp3',
              name: 'Song',
            },
          ],
        },
      ],
    });

    const loaded = await projectService.loadProjectFromData(file, 'D:\\parties\\set.cherry');

    expect(loaded.collections?.[0]?.items[0]).toEqual({
      id: 'relative-track',
      path: 'D:\\parties\\collections\\relative-collection\\song.mp3',
      name: 'Song',
      isMissing: false,
    });
    expect(mockStatFile).toHaveBeenCalledWith(
      'D:\\parties\\collections\\relative-collection\\song.mp3',
    );
  });
});
